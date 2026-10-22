/** A sixty-second, one-target-at-a-time aim drill. No match economy or spike state. */
export class RangeSession {
  constructor({duration=60}={}){
    this.duration=duration;this.time=0;this.shots=0;this.hits=0;this.headHits=0;this.kills=0;this.headKills=0;this.score=0;this.lastTarget=-1;
  }
  get remaining(){return Math.max(0,this.duration-this.time);}
  get complete(){return this.remaining<=1e-8;}
  tick(dt){if(Number.isFinite(dt)&&dt>0)this.time=Math.min(this.duration,this.time+dt);return this.complete;}
  recordShot(){if(!this.complete)this.shots++;}
  recordHit({head=false,eliminated=false}={}){
    if(this.complete)return;
    this.hits++;if(head)this.headHits++;
    if(eliminated){this.kills++;if(head)this.headKills++;this.score+=head?150:100;}
  }
  nextTarget(count,random=Math.random){
    if(count<=0)return-1;
    let index=Math.min(count-1,Math.max(0,Math.floor(random()*count)));
    if(count>1&&index===this.lastTarget)index=(index+1)%count;
    this.lastTarget=index;return index;
  }
  summary(){return{score:this.score,kills:this.kills,shots:this.shots,hits:this.hits,headKills:this.headKills,
    accuracy:this.shots?Math.round(this.hits/this.shots*100):0,headRate:this.hits?Math.round(this.headHits/this.hits*100):0,duration:this.duration};}
}
