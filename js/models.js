//#################################
// longitudinal models
//#################################


/**
longitudinal model IDM

@param v:     desired speed [m/s]
@param T:     desired time gap [s]
@param s0:    minimum gap [m]
@param a:     maximum acceleration [m/s^2]
@param b:     comfortable deceleration [m/s^2]

@return:      IDM instance (constructor)
*/

 
function IDM(v0,T,s0,a,b){
    this.v0=v0; 
    this.T=T;
    this.s0=s0;
    this.a=a;
    this.b=b;
    this.alpha_v0=1; // multiplicator for temporary reduction

    // possible restrictions (value 1000 => initially no restriction)

    this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
    this.speedmax=1000; // if vehicle restricts speed, speedmax<speedlimit, v0
    this.bmax=16;
}

/**
IDM acceleration function

@param s:     actual gap [m]
@param v:     actual speed [m/s]
@param vl:    leading speed [m/s]
@param al:    leading accel [m/s^2] (only for common interface; ignored)

@return:  acceleration [m/s^2]
*/


IDM.prototype.calcAcc=function(s,v,vl,al){ // this works as well

        //MT 2016: noise to avoid some artifacts

    var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
    var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

        // determine valid local v0

    var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
    v0eff*=this.alpha_v0;

        // actual acceleration model

    var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	: this.a*(1-v/v0eff);
    var sstar=this.s0
	+Math.max(0.,v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b));
    var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
    var accInt_IDMplus=accInt+this.a;

        // return original IDM

    return (v0eff<0.00001) ? 0 
	: Math.max(-this.bmax, accFree + accInt + accRnd);

        // return IDM+

	//return (v0eff<0.00001) ? 0
        // : Math.max(-this.bmax, Math.min(accFree, accInt_IDMplus) + accRnd);

}//IDM.prototype.calcAcc



/**
IDM "give way" function for passive merges (the merging vehicle has priority) 
It returns the "longitudinal-transversal coupling" 
acceleration as though the priority vehicle has already merged/changed
if this does not include an emergency braking (decel<2*b)

For the interface and further explanations see ACC.prototype.calcAcc
*/

IDM.prototype.calcAccGiveWay=function(sNew, v, vPrio){
    var accNew=this.calcAcc(sNew, v, vPrio, 0);
    return (accNew>-2*this.b) ? accNew : acc;
}





/**
MT 2016: longitudinal model ACC: Has same parameters as IDM 
but exactly triangular steady state and "cooler" reactions if gap too small

@param v:     desired speed [m/s]
@param T:     desired time gap [s]
@param s0:    minimum gap [m]
@param a:     maximum acceleration [m/s^2]
@param b:     comfortable deceleration [m/s^2]

@return:      ACC instance (constructor)
*/



//!! Chromium does not know Math.tanh(!!)

function myTanh(x){
    return (x>50) ? 1 : (x<-50) ? -1 : (Math.exp(2*x)-1)/(Math.exp(2*x)+1);
}

function ACC(v0,T,s0,a,b){
    this.v0=v0; 
    this.T=T;
    this.s0=s0;
    this.a=a;
    this.b=b;
    this.cool=0.99;
    this.alpha_v0=1; // multiplicator for temporary reduction

    this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
    this.speedmax=1000; // if vehicle restricts speed, speedmax<speedlimit, v0
    this.bmax=18;
}



/**
ACC acceleration function

@param s:     actual gap [m]
@param v:     actual speed [m/s]
@param vl:    leading speed [m/s]
@param al:    leading acceleration [m/s^2] (optional; al=0 if 3 args)

@return:  acceleration [m/s^2]
*/


ACC.prototype.calcAcc=function(s,v,vl,al){ // this works as well

    if(s<0.0001){return -this.bmax;}

    // noise to avoid some artifacts

    var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
    var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

        // determine valid local v0

    var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
    v0eff*=this.alpha_v0;

        // actual acceleration model

    var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	: this.a*(1-v/v0eff);
    var sstar=this.s0
	+Math.max(0, v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b));
    var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
    var accIDM=accFree+accInt;

    var accCAH=(vl*(v-vl) < -2*s*al)
	? v*v*al/(vl*vl -2*s*al) 
	: al - Math.pow(v-vl,2)/(2*Math.max(s,0.01)) * ((v>vl) ? 1 : 0);
    accCAH=Math.min(accCAH,this.a);

    var accMix=(accIDM>accCAH)
	    ? accIDM
	    : accCAH+this.b*myTanh((accIDM-accCAH)/this.b);
    var arg=(accIDM-accCAH)/this.b;

    var accACC=this.cool*accMix +(1-this.cool)*accIDM;

    var accReturn=(v0eff<0.00001) ? 0 : Math.max(-this.bmax, accACC + accRnd);

        // log and return

	//if(this.alpha_v0<0.6){ // alpha not yet used

    if(false){
          console.log("ACC.calcAcc:"
		      +" speedlimit="+this.speedlimit // no u,v!
		      +" s="+s
		      +" v="+v
		      +" vl="+vl
		      +" al="+al
		      +" accFree="+accFree
		      +" accIDM="+accIDM
		      +" accCAH="+accCAH
		      +" accACC="+accACC
		      +" accReturn="+accReturn)
    }
    return accReturn;

}//ACC.prototype.calcAcc


/**
ACC "give way" function for passive merges (the merging vehicle has priority) 
It returns the "longitudinal-transversal coupling" 
acceleration as though the priority vehicle has already merged/changed
if this does not include an emergency braking (decel<2*b)

Notice 1: The caller must ensure that this function 
is only called for the first vehicle behind a merging vehicle 
having priority. 

Notice 2: No actual lane change is involved. The lane change of the merging vehicle
is just favoured in the next steps by this longitudinal-transversal coupling

Notice 3: For active merges to priority roads 
(the mainroad vehicles have priority) 
use MOBIL.respectPriority to determine if the merge is OK


@param sNew:   gap subject - priority vehicle [m] after a potential merging
@param v:      speed of subject vehicle [m/s]
@param vPrio:  speed of the priority vehicle [m/s]
@param accOld: acceleration before LT coupling

@return:  acceleration response [m/s^2] to the merging veh with priority
*/

ACC.prototype.calcAccGiveWay=function(sNew, v, vPrio, accOld){
    var accNew=this.calcAcc(sNew, v, vPrio, 0);

    // !! 0.1*this.b consistent with MOBIL.prototype.respectPriority
    // !! 2*this.b consistent with MOBIL.bSafe

    var priorityRelevant=(accOld-accNew>0.1*this.b); 
    //return priorityRelevant&&(accNew>-2*this.b)
//	    ? Math.min(accNew,-this.b) : accOld;
    return -4;
}

//#################################
// lane-changing models
//#################################

/**
generalized lane-changing model MOBIL:
at present no politeness but speed dependent safe deceleration 

@param bSafe:          safe deceleration [m/s^2] at maximum speed v=v0
@param bSafeMax:       safe deceleration [m/s^2]  at speed zero (gen. higher)
@param p:              politeness factor (0=egoistic driving)
@param bThr:           lane-changing threshold [m/s^2] 
@param bBiasRight:     bias [m/s^2] to the right
@param targetLanePrio: vehicles on target lane have priority
@return:               MOBIL instance (constructor)
*/

function MOBIL(bSafe, bSafeMax, p, bThr, bBiasRight){

    this.bSafe=bSafe;
    this.bSafeMax=bSafeMax; 
    this.p=p;
    this.bThr=bThr;
    this.bBiasRight=bBiasRight;
}


/**
generalized MOBIL lane chaning decision
with bSafe increasing with decrease vrel=v/v0
but at present w/o politeness

@param vrel:            v/v0; increase bSave with decreasing vrel
@param acc:             own acceleration at old lane
@param accNew:          prospective own acceleration at new lane
@param accLagNew:       prospective accel of new leader
@param toRight:         1 if true, 0 if not
@return: whether an immediate lane change is safe and desired
*/

MOBIL.prototype.realizeLaneChange=function(vrel,acc,accNew,accLagNew,
					   toRight,log){

    // safety criterion

    var bSafeActual=vrel*this.bSafe+(1-vrel)*this.bSafeMax;
    if(accLagNew<-bSafeActual){return false;}


    // incentive criterion

    var dacc=accNew-acc+this.p*accLagNew //!! new
	+ this.bBiasRight*((toRight) ? 1 : -1)- this.bThr;


    // debug before return

    if(false){
    //if(dacc>0){console.log("positive MOBIL LC decision!");
	console.log(
		"positive MOBIL LC decision!",
		"\n vrel=",parseFloat(vrel).toFixed(2),
		" bSafeActual=",parseFloat(bSafeActual).toFixed(2),
		" acc=",parseFloat(acc).toFixed(2),
		" accNew=",parseFloat(accNew).toFixed(2),
		" bBiasRight=",parseFloat(this.bBiasRight).toFixed(2),
		" bThr=",parseFloat(this.bThr).toFixed(2)
	);
    }



    return (dacc>0);
}



/**
check first for priority if merging to a priority lane.
In contrast to the safety criterion (critical deceleration), 
the criterion here is a rather small critical acceleration *change*

@param accLag:    actual acceleration of the target lag vehicle
@param accLagNew: acceleration of this vehicle after a prospective change

@return:          true if the mainroad (target lane) vehicle would be obstructed by
                  the changing by more than a very small amount
*/

MOBIL.prototype.respectPriority=function(accLag,accLagNew){

    if(this.targetLanePrio){
	return(accLag-accLagNew>0.1);
    }
}
