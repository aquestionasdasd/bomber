"""Offline Cycles diffuse direct/indirect + AO baking for the complete TRC stage.
Run export-trc-bake.mjs first; arguments after --: input JSON, output directory.
Use a separate Blender --background --factory-startup process only.
"""
import bpy, json, sys, os, hashlib, math
import numpy as np
from mathutils import Vector, Matrix
args=sys.argv[sys.argv.index('--')+1:]
data=json.load(open(args[0],encoding='utf8'));cfg=data['config']
out=os.path.abspath(args[1]);os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=cfg['samples']
scene.cycles.use_denoising=True;scene.cycles.max_bounces=cfg['bounces']
# Keep the atlas in memory; avoid loss-prone temporary EXR tile-buffer IO.
scene.cycles.use_auto_tile=False
scene.render.threads_mode='FIXED';scene.render.threads=8
device='CPU'
for backend in ['OPTIX','CUDA']:
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type=backend;prefs.get_devices()
  gpu=[d for d in prefs.devices if d.type==backend]
  if gpu:
   for d in prefs.devices:d.use=d.type==backend
   scene.cycles.device='GPU';device=backend;break
 except Exception:pass
print('BAKE_DEVICE',device,flush=True)
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background']
bg.inputs[0].default_value=(*cfg['world']['color'],1);bg.inputs[1].default_value=cfg['world']['strength']
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=0;scene.view_settings.gamma=1
def save_png8(image,path):
 # Runtime uploads 8-bit linear textures; avoid distributing unused 16-bit PNGs.
 packed=bpy.data.images.new('Export '+image.name,*image.size,alpha=False,float_buffer=False)
 packed.colorspace_settings.name='Non-Color'
 values=np.empty(image.size[0]*image.size[1]*4,dtype=np.float32);image.pixels.foreach_get(values)
 packed.pixels.foreach_set(np.clip(values,0,1));packed.filepath_raw=path;packed.file_format='PNG';packed.save()
 bpy.data.images.remove(packed)
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
for i,src in enumerate(data['lights']):
 lamp=bpy.data.lights.new('TRC fixture '+str(i),'AREA');lamp.energy=src['energy'];lamp.shape='RECTANGLE';lamp.size=src['width'];lamp.size_y=src['depth'];lamp.color=src['color']
 obj=bpy.data.objects.new(lamp.name,lamp);scene.collection.objects.link(obj);obj.location=xyz(src['position'])
sun=bpy.data.lights.new('Exterior daylight','SUN');sun.energy=cfg['sun']['energy'];sun.angle=cfg['sun']['angle']
obj=bpy.data.objects.new(sun.name,sun);scene.collection.objects.link(obj);obj.rotation_euler=cfg['sun']['rotation']
bpy.ops.object.select_all(action='DESELECT')
for obj in selected:obj.select_set(True)
bpy.context.view_layer.objects.active=selected[0]
# One target mesh with material slots avoids a full Cycles resync per batch.
bpy.ops.object.join()
scene.render.bake.margin=cfg['padding']-1;scene.render.bake.use_clear=True
for name,kind,edge in [('lighting','DIFFUSE',cfg['size']),('ao','AO',cfg['aoSize'])]:
 image=bpy.data.images.new(name,edge,edge,alpha=False,float_buffer=True);image.colorspace_settings.name='Non-Color'
 for node in materials:node.image=image
 print('BAKE_START',name,flush=True)
 kwargs={'type':kind}
 if kind=='DIFFUSE':kwargs['pass_filter']={'DIRECT','INDIRECT'}
 bpy.ops.object.bake(**kwargs)
 save_png8(image,os.path.join(out,name+'.png'))
 print('BAKE_SAVED',name,flush=True)
# Bake textures are NOT denoised by Cycles' render denoising switch. Integrate
# irradiance inside rectangular charts only, retaining the pilot's smooth style.
img=bpy.data.images['lighting'];pixels=np.empty(cfg['size']*cfg['size']*4,dtype=np.float32)
img.pixels.foreach_get(pixels);pixels=pixels.reshape((cfg['size'],cfg['size'],4))
sigma=2.6;radius=max(2,math.ceil(sigma*2));pad=cfg['padding']-1
kernel=np.exp(-np.arange(-radius,radius+1,dtype=np.float32)**2/(2*sigma**2));kernel/=kernel.sum()
for c in data['atlas']:
 if not c['rectangular']:continue
 x,y,w,h=[c[k] for k in ['x','y','w','h']];region=pixels[y:y+h,x:x+w,:3].copy()
 for axis in [0,1]:
  pads=[(0,0),(0,0),(0,0)];pads[axis]=(radius,radius);padded=np.pad(region,pads,mode='edge');filtered=np.zeros_like(region)
  for i,weight in enumerate(kernel):filtered+=(padded[i:i+h,:,:] if axis==0 else padded[:,i:i+w,:])*weight
  region=filtered
 pixels[y-pad:y+h+pad,x-pad:x+w+pad,:3]=np.pad(region,((pad,pad),(pad,pad),(0,0)),mode='edge')
pixels[:,:,:3]*=cfg['encodingScale'];img.pixels.foreach_set(pixels.ravel());save_png8(img,os.path.join(out,'lighting.png'))
del pixels
camera=bpy.data.cameras.new('TRC local reflection probe');camera.lens=18;camera.sensor_width=36
obj=bpy.data.objects.new(camera.name,camera);scene.collection.objects.link(obj);scene.camera=obj
scene.render.resolution_x=128;scene.render.resolution_y=128;scene.render.resolution_percentage=100;scene.cycles.samples=24
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
faces=[('px',(1,0,0),(0,1,0)),('nx',(-1,0,0),(0,1,0)),('py',(0,1,0),(0,0,-1)),('ny',(0,-1,0),(0,0,1)),('pz',(0,0,1),(0,1,0)),('nz',(0,0,-1),(0,1,0))]
assets=['lighting','ao']
for probe in cfg['probes']:
 obj.location=xyz(probe['position'])
 for name,direction,up in faces:
  f=Vector(xyz(direction));u=Vector(xyz(up));r=f.cross(u)
  obj.rotation_euler=Matrix((r,u,-f)).transposed().to_euler()
  filename=probe['id']+'-'+name;assets.append(filename);scene.render.filepath=os.path.join(out,filename+'.png');bpy.ops.render.render(write_still=True)
meta={k:data[k] for k in ['hash','size','density','charts']}
meta.update(scope='TRC complete stage',aoSize=cfg['aoSize'],probes=[p['id'] for p in cfg['probes']],lights=len(data['lights']),engine='Blender 4.2 / Cycles',device=device,samples=cfg['samples'],bounces=cfg['bounces'],denoise='chart-bounded Gaussian irradiance / sigma %.3f texels'%sigma,encodingScale=cfg['encodingScale'])
meta['assetHash']=hashlib.sha256(b''.join(open(os.path.join(out,n+'.png'),'rb').read() for n in assets)).hexdigest()[:16]
open(os.path.join(out,'manifest.json'),'w',encoding='utf8').write(json.dumps(meta,indent=2)+'\n')
open(os.path.join(out,'..','..','trc-bake.js'),'w',encoding='utf8').write('export const TRC_BAKE='+json.dumps(meta)+';\n')
print('BAKE_COMPLETE',json.dumps(meta),flush=True)
