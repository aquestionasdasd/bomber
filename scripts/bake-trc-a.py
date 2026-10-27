"""Blender 4.2 background: actual Cycles diffuse direct/indirect + AO atlases.
Run export-trc-a-bake.mjs first; arguments after -- are input JSON, output folder.
Only factory-startup/background processes should run this authoring tool.
"""
import bpy, json, sys, os, hashlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
data=json.load(open(args[0],encoding='utf8'));out=os.path.abspath(args[1]);os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=128
scene.cycles.use_denoising=True;scene.cycles.max_bounces=6
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.26,.34,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=0;scene.view_settings.gamma=1
selected=[];materials=[]
def xyz(p):return (p[0],-p[2],p[1])
for src in data['objects']:
 p=src['position'];verts=[xyz(p[i:i+3]) for i in range(0,len(p),3)]
 mesh=bpy.data.meshes.new(src['name']);mesh.from_pydata(verts,[],[(i,i+1,i+2) for i in range(0,len(verts),3)]);mesh.update()
 obj=bpy.data.objects.new(src['name'],mesh);scene.collection.objects.link(obj)
 mat=bpy.data.materials.new(src['name']);mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF')
 bsdf.inputs['Base Color'].default_value=(*src['color'],1);bsdf.inputs['Roughness'].default_value=.8
 bsdf.inputs['Emission Color'].default_value=(*src['emission'],1);bsdf.inputs['Emission Strength'].default_value=1
 obj.data.materials.append(mat)
 if src['selected']:
  layer=mesh.uv_layers.new(name='Lightmap');uv=src['uv']
  for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index*2:loop.vertex_index*2+2]
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');mat.node_tree.nodes.active=node
  selected.append(obj);materials.append(node)
# Broad fixtures aligned along the real bent corridor; warm A-main, cool daylight.
for x,z in [(18,108),(18,100),(18,94),(30,91),(28,85),(18,84),(18,76),(19,66),(28,64)]:
 lamp=bpy.data.lights.new('A main broad ceiling fixture','AREA');lamp.energy=450;lamp.shape='RECTANGLE';lamp.size=4;lamp.size_y=1.8;lamp.color=(1,.88,.72)
 obj=bpy.data.objects.new(lamp.name,lamp);scene.collection.objects.link(obj);obj.location=xyz((x-55,5.03,z-70))
sun=bpy.data.lights.new('Exterior daylight','SUN');sun.energy=1.5;sun.angle=.08
obj=bpy.data.objects.new(sun.name,sun);scene.collection.objects.link(obj);obj.rotation_euler=(.3,-.45,-.6)
bpy.ops.object.select_all(action='DESELECT')
for obj in selected:obj.select_set(True)
bpy.context.view_layer.objects.active=selected[0]
scene.render.bake.margin=3;scene.render.bake.use_clear=True
for name,kind in [('lighting','DIFFUSE'),('ao','AO')]:
 image=bpy.data.images.new(name,data['size'],data['size'],alpha=False,float_buffer=True)
 image.colorspace_settings.name='Non-Color'
 for node in materials:node.image=image
 print('BAKE_START',name,flush=True)
 kwargs={'type':kind}
 if kind=='DIFFUSE':kwargs['pass_filter']={'DIRECT','INDIRECT'}
 bpy.ops.object.bake(**kwargs)
 image.filepath_raw=os.path.join(out,name+'.png');image.file_format='PNG';image.save()
 print('BAKE_SAVED',name,flush=True)
# Integrate noisy diffuse samples within each rectangular UV island. Filtering
# never crosses a chart boundary; bevel triangles and AO retain their detail.
# This is offline irradiance filtering, not an extra material texture.
import numpy as np
img=bpy.data.images['lighting'];pixels=np.array(img.pixels[:],dtype=np.float32).reshape((data['size'],data['size'],4))
kernel=np.exp(-np.arange(-5,6,dtype=np.float32)**2/(2*2.6**2));kernel/=kernel.sum()
for c in data['atlas']:
 if not c['rectangular'] or min(c['w'],c['h'])<12:continue
 x,y,w,h=[c[k] for k in ['x','y','w','h']];region=pixels[y:y+h,x:x+w,:3].copy()
 for axis in [0,1]:
  pads=[(0,0),(0,0),(0,0)];pads[axis]=(5,5);padded=np.pad(region,pads,mode='edge');filtered=np.zeros_like(region)
  for i,weight in enumerate(kernel):
   part=padded[i:i+h,:,:] if axis==0 else padded[:,i:i+w,:]
   filtered+=part*weight
  region=filtered
 pixels[y:y+h,x:x+w,:3]=region
 # Refill the bake padding from the filtered edges so minification is clean.
 pixels[y-3:y+h+3,x-3:x+w+3,:3]=np.pad(region,((3,3),(3,3),(0,0)),mode='edge')
pixels[:,:,:3]*=.25
img.pixels.foreach_set(pixels.ravel());img.filepath_raw=os.path.join(out,'lighting.png');img.file_format='PNG';img.save()
# Local reflection probe; diffuse uses the atlases, metal trim uses this subtly.
camera=bpy.data.cameras.new('A main reflection probe');camera.lens=18;camera.sensor_width=36
obj=bpy.data.objects.new(camera.name,camera);scene.collection.objects.link(obj);obj.location=xyz((-25,2.4,21));scene.camera=obj
scene.render.resolution_x=128;scene.render.resolution_y=128;scene.render.resolution_percentage=100;scene.cycles.samples=24
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
for name,direction,up in [('px',(1,0,0),(0,1,0)),('nx',(-1,0,0),(0,1,0)),('py',(0,1,0),(0,0,-1)),('ny',(0,-1,0),(0,0,1)),('pz',(0,0,1),(0,1,0)),('nz',(0,0,-1),(0,1,0))]:
 # Camera's local Y is the cube face's up axis, local -Z is its forward axis.
 from mathutils import Matrix
 f=Vector(xyz(direction));u=Vector(xyz(up));r=f.cross(u)
 obj.rotation_euler=Matrix((r,u,-f)).transposed().to_euler();scene.render.filepath=os.path.join(out,name+'.png');bpy.ops.render.render(write_still=True)
meta={k:data[k] for k in ['hash','size','density','charts']};meta.update(engine='Blender 4.2 / Cycles',samples=128,bounces=6,denoise='chart-bounded Gaussian irradiance integration / sigma 2.6 texels',encodingScale=.25)
meta['assetHash']=hashlib.sha256(b''.join(open(os.path.join(out,n+'.png'),'rb').read() for n in ['lighting','ao','px','nx','py','ny','pz','nz'])).hexdigest()[:16]
open(os.path.join(out,'manifest.json'),'w',encoding='utf8').write(json.dumps(meta,indent=2)+'\n')
open(os.path.join(out,'..','..','trc-a-bake.js'),'w',encoding='utf8').write('export const TRC_A_BAKE='+json.dumps(meta)+';\n')
print('BAKE_COMPLETE',json.dumps(meta),flush=True)
