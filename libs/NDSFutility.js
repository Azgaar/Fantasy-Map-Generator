/* NDSFutility.js JavaScript functions for NDSF coordinate conversion utility */

/* most conversion functions were converted from C fucntions provided by 
   Dana Yoerger, Steve Gegg, and Louis Whitcomb at WHOI*/

CMS_INCH = 2.54; 		/* cms/inch */
METERS_FOOT = 0.3048; 		/* meters/foot */
METERS_NMILE = 1852.0; 		/* meters/nautical mile */
METERS_FATHOM = 1.8288;  	/* meters/fathom (straight conversion) */
UMETERS_UFATHOM = 1.8750; 	/* unc mtrs/unc fthm - accounts for */
				/* snd vel of 1500m/sec to 800fm/sec */
PI = 3.1415927;
TWO_PI = 6.2831854;  
RTOD =57.29577951308232; 
DTOR =(1.0/RTOD); 
RADIANS = 57.2957795; 		/* degrees/radian */
SECS_HOUR = 3600; 
/* coordinate translation options */
XY_TO_LL= 1;
LL_TO_XY= 2;
LL_TO_LL= 3;

/* coordinate system types  */
GPS_COORDS_WGS84 = 1;
GPS_COORDS_C1866 = 2;
LORANC_COORDS = 3;
SURVEY_COORDS = 4;
TRANSIT_COORDS = 5;

RADIUS = 6378137.0;
FLATTENING = 0.00335281068; /* GRS80 or WGS84 */
K_NOT = 0.9996;     /* UTM scale factor */
DEGREES_TO_RADIANS = 0.01745329252;
FALSE_EASTING = 500000.0;
FALSE_NORTHING = 10000000.0;

function checkForm(form)
{
   if (form["from"].value =="") 
   {
      alert("Please select 'from'.");
      return false;
   }
   if (form["to"].value == "") 
   {
      alert("Please select 'to'.");
      return false;
   }
   return true;
}


function ChangeUNS(Form) 
{
   if( Form.UNS.value == "N" )
   {
        Form.UNS.value = "S";
   }
   else 
   {
        Form.UNS.value = "N";
   }
}

function ChangeNS(Form) 
{
   if( Form.NS.value == "N" )
   {
        Form.NS.value = "S";
   }
   else 
   {
        Form.NS.value = "N";
   }
}

function ChangeEW(Form) 
{
   if( Form.EW.value == "W" )
   {
        Form.EW.value = "E";
   }
   else 
   {
        Form.EW.value = "W";
   }
}

function ChangeSNS(Form) 
{
   if( Form.SNS.value=="N" )
   {
        Form.SNS.value="S";
   }
   else 
   {
        Form.SNS.value="N";
   }
}

function ChangeSEW(Form) 
{
   if( Form.SEW.value=="W" )
   {
        Form.SEW.value="E";
   }
   else 
   {
        Form.SEW.value="W";
   }
}

function ClearXY(Form)
{
   /* when changing input, clear the results first*/
   Form.Xcord.value=""; Form.Ycord.value="";
}

function ClearLL(Form)
{
   /* when changing input, clear the results first*/
   Form.DecSLat.value=""; 
   Form.SLatDeg.value=""; 
   Form.SLatMin.value=""; 
   Form.SNS.value="";

   Form.DecSLon.value="";
   Form.SLonDeg.value="";
   Form.SLonMin.value="";
   Form.SEW.value="";
}

function ClearLatDM(Form)
{
   Form.SLatDeg.value=""; 
   Form.SLatMin.value=""; 
}

function ClearLonDM(Form)
{

   Form.SLonDeg.value="";
   Form.SLonMin.value="";
}

function ClearLatDecDeg(Form)
{
   Form.DecSLat.value=""; 
}

function ClearLonDecDeg(Form)
{
   Form.DecSLon.value=""; 
}

function ClearOLatDM(Form)
{
   Form.LatDeg.value=""; 
   Form.LatMin.value=""; 
}

function ClearOLonDM(Form)
{
   Form.LonDeg.value="";
   Form.LonMin.value="";
}

function ClearOLatDecDeg(Form)
{
   Form.DecLat.value=""; 
}

function ClearOLonDecDeg(Form)
{
   Form.DecLon.value=""; 
}

function ClearUTM(Form)
{
   /* when changing input, clear the results first*/
   Form.UTMX.value=""; Form.UTMY.value="";
   if ( Form.name == "LL2UTMForm" ) Form.UTMZone.value="";
   if ( Form.name == "XY2UTMForm" ) Form.UTMZone.value="";
}

function DEG_TO_RADIANS(x)
{ 
    return (x/RADIANS); 
}

function RAD_TO_DEGREES(x)
{  
    return (x*RADIANS); 	/* radians (a) to degrees */
}

function DEGMIN_TO_DECDEG(x,y)
{
    return (x + y/60.0);	/* deg,min to decimal degrees */
}

function DEGMIN_TO_SECS(x,y)
{
    return ((x*3600.0)+(y*60.0)); /* deg,min to seconds */

}

function MSEC_TO_KNOTS(x)
{ 
    return ((x/METERS_NMILE)*SECS_HOUR); 
} 

function KNOTS_TO_MSEC(x)
{
    return ((x*METERS_NMILE)/SECS_HOUR); 
}

function FEET_TO_METERS(x)
{
    return (X * METERS_FOOT); 
}

function deg_min_2_deg(deg,dec_min)
{
    /* convert deg and min to decimal degrees */
    dec_deg = deg*1 + (dec_min/60.0);

    return (dec_deg);
}

function deg_min_sec_2_deg(deg,min,sec)
{ 
    dec_deg = deg*1.0 + (min/60.0) +(sec/3600.0);
    return (dec_deg);
}


function deg_2_deg_min (x)
{
  with(Math)
  {
    whole_deg = floor(abs(x))*((x > 0.0) ? 1.0 : -1.0);
    dec_min = (60.0*(x - (whole_deg)));

    if (dec_min.toFixed(4) >=60)
    {
          dec_min=0;
          whole_deg=whole_deg + 1;
    }
    dm={};
    dm={deg:whole_deg,min:dec_min};
    return(dm);
  }
}

function METERS_DEGLON(x)
{  
   with (Math)
   {
      var d2r=DEG_TO_RADIANS(x);
      return((111415.13 * cos(d2r))- (94.55 * cos(3.0*d2r)) + (0.12 * cos(5.0*d2r)));
   }
}

function METERS_DEGLAT(x)
{
   with (Math)
   {
      var d2r=DEG_TO_RADIANS(x);
      return(111132.09 - (566.05 * cos(2.0*d2r))+ (1.20 * cos(4.0*d2r)) - (0.002 * cos(6.0*d2r)));
   }
}

/*----------------------------------------------------------
#   The following functions are modified from the origin
#   C functions created by Louis Whitcomb 19 Jun 2001
#   Fixed translate_coordinates by TeaWithLucas 2019
 ---------------------------------------------------------*/
/*----------------------------------------------------------
#   translate_coordinates
#   routine to translate between geographic and cartesian coordinates
#   user must supply following data on the cartesian coordinate system:
#   location of the origin in lat/lon degrees;
#   rotational skew from true north in degrees;
#   N.B. sense of rotation i/p here is exactly as o/p by ORIGIN
#   x/y offset in meters - only if an offset was used during the
#   running of prog ORIGIN;
*/

function translate_coordinates(trans_option,porg) {
  with(Math) {   
    var xx,yy,r,ct,st,angle;
    angle = DEG_TO_RADIANS(porg.rotation_angle_degs);
    if( trans_option == XY_TO_LL) {
      /* X,Y to Lat/Lon Coordinate Translation  */
      pxpos_mtrs = porg.x;  
      pypos_mtrs = porg.y;
      xx = pxpos_mtrs - porg.xoffset_mtrs;
      yy = pypos_mtrs - porg.yoffset_mtrs;
      r = sqrt(xx*xx + yy*yy);

      if(r) {
        ct = xx/r;
        st = yy/r;
        xx = r * ( (ct * cos(angle))+ (st * sin(angle)) );
        yy = r * ( (st * cos(angle))- (ct * sin(angle)) );
      }

      var plon = porg.olon + xx/METERS_DEGLON(porg.olat);
      var plat = porg.olat + yy/METERS_DEGLAT(porg.olat);

      //if plon or plat are above max values, find where it would be
      while(plon < -180){
        plon +=360;
      }
      while (plon > 180){
        plon -= 360;
      }
      while(plat < -90){
        plat +=180;
      }
      while (plat > 90){
        plat -= 180;
      }
      
      var sll={};
      sll={slat:plat, slon:plon};

      return(sll);

    } else if(trans_option == LL_TO_XY) {

      xx = (porg.slon - porg.olon)*METERS_DEGLON(porg.olat);
      yy = (porg.slat - porg.olat)*METERS_DEGLAT(porg.olat);

      r = sqrt(xx*xx + yy*yy);

      /* alert('LL_TO_XY: xx=' + xx + ' yy=' + yy + ' r=' + r);
      return false;*/

      if(r){
        ct = xx/r;
        st = yy/r;
        xx = r * ( (ct * cos(angle)) + (st * sin(angle)) );
        yy = r * ( (st * cos(angle)) - (ct * sin(angle)) );
      }

      pxpos_mtrs = xx + porg.xoffset_mtrs;
      pypos_mtrs = yy + porg.yoffset_mtrs;

      var sxy={};
      sxy={x:pxpos_mtrs, y:pypos_mtrs};

      return(sxy);
    }
  }
}
/*-------------------------------------------------*/

function utm_zone(slat, slon)
{
   with(Math)
   {
      /* determine the zone for the given longitude 
         with 6 deg wide longitudinal strips */

      var zlon= slon + 180; /* set the lon from 0-360 */
   
      for (var i=1; i<=60; i++)
      { 
         if ( zlon >= (i-1)*6 & zlon < i*6)
         {
            break;
         }
      }
      var zone=i;

      /*  modify the zone number for special areas */
      if ( slat >=72 & (slon >=0 & slon <=36))
      {
          if (slon < 9.0)
          {
              zone= 31;
          }
          else if ( slon  >= 9.0 & slon < 21)
          {
              zone= 33;
          }
          else if ( slon >= 21.0 & slon < 33)
          {
              zone= 35;
          }
          else if ( slon  >= 33.0 & slon < 42)
          {
             zone= 37;
          }
      }
      if ( (slat >=56 & slat < 64) & (slon >=3 & slon < 12))
      {
          zone= 32;  /* extent to west ward for 3deg more */
      }
      return (zone);
    }
    return true;
}

/*-------------------------------------------------*/

function geo_utm(lat, lon, zone)
{
   with(Math)
   {
      /* first compute the necessary geodetic parameters and constants */

      lambda_not = ((-180.0 + zone*6.0) -3.0)/RADIANS ;
      e_squared = 2.0 * FLATTENING - FLATTENING*FLATTENING;
      e_fourth = e_squared * e_squared;
      e_sixth = e_fourth * e_squared;
      e_prime_sq = e_squared/(1.0 - e_squared);
      sin_phi = sin(lat);
      tan_phi = tan(lat);
      cos_phi = cos(lat);
      N = RADIUS/sqrt(1.0 - e_squared*sin_phi*sin_phi);
      T = tan_phi*tan_phi;
      C = e_prime_sq*cos_phi*cos_phi;
      M = RADIUS*((1.0 - e_squared*0.25 -0.046875*e_fourth  -0.01953125*e_sixth)*lat-
	      (0.375*e_squared + 0.09375*e_fourth +
				 0.043945313*e_sixth)*sin(2.0*lat) +
	      (0.05859375*e_fourth + 0.043945313*e_sixth)*sin(4.0*lat) -
	      (0.011393229 * e_sixth)*sin(6.0*lat));
      A = (lon - lambda_not)*cos_phi;
      A_sq = A*A;
      A_fourth =  A_sq*A_sq;
  
      /* now go ahead and compute X and Y */
  
      x_utm = K_NOT*N*(A + (1.0 - T + C)*A_sq*A/6.0 +
		   (5.0 - 18.0*T + T*T + 72.0*C - 
		    58.0*e_prime_sq)*A_fourth*A/120.0);
  
      /* note:  specific to UTM, vice general trasverse mercator.  
         since the origin is at the equator, M0, the M at phi_0, 
         always equals zero, and I won't compute it   */                                            
  
       y_utm = K_NOT*(M + N*tan_phi*(A_sq/2.0 + 
			    (5.0 - T + 9.0*C + 4.0*C*C)*A_fourth/24.0 +
			    (61.0 - 58.0*T + T*T + 600.0*C - 
			     330.0*e_prime_sq)*A_fourth*A_sq/720.0));
  
       /* now correct for false easting and northing */
  
       if( lat < 0)
       {
          y_utm +=10000000.0;
       }
       x_utm +=500000;

       /* adds Java function returns */
       var utmxy={};
       utmxy={x:x_utm,y:y_utm};
       return(utmxy);
    }
    return true;
}


/*-------------------------------------------------------*/

function utm_geo(x_utm, y_utm, zone)
{
   with(Math)
   {
      /* first, subtract the false easting */
      x_utm = x_utm - FALSE_EASTING;

      /* compute the necessary geodetic parameters and constants */

      e_squared = 2.0 * FLATTENING - FLATTENING*FLATTENING;
      e_fourth = e_squared * e_squared;
      e_sixth = e_fourth * e_squared;
      oneminuse = sqrt(1.0-e_squared);  

      /* compute the footpoint latitude */

      M = y_utm/K_NOT;
      mu =M/(RADIUS*(1.0 - 0.25*e_squared - 
                  0.046875*e_fourth - 0.01953125*e_sixth));
      e1 = (1.0 - oneminuse)/(1.0 + oneminuse);
      e1sq =e1*e1;
      footpoint = mu + (1.5*e1 - 0.84375*e1sq*e1)*sin(2.0*mu) +
              (1.3125*e1sq - 1.71875*e1sq*e1sq)*sin(4.0*mu) +
              (1.57291666667*e1sq*e1)*sin(6.0*mu) +
              (2.142578125*e1sq*e1sq)*sin(8.0*mu);


      /* compute the other necessary terms */

      e_prime_sq =  e_squared/(1.0 -  e_squared);
      sin_phi = sin(footpoint);
      tan_phi = tan(footpoint);
      cos_phi = cos(footpoint);
      N = RADIUS/sqrt(1.0 - e_squared*sin_phi*sin_phi);
      T = tan_phi*tan_phi;
      Tsquared = T*T;
      C = e_prime_sq*cos_phi*cos_phi;
      Csquared = C*C;
      denom = sqrt(1.0-e_squared*sin_phi*sin_phi);
      R = RADIUS*oneminuse*oneminuse/(denom*denom*denom);
      D = x_utm/(N*K_NOT);
      Dsquared = D*D;
      Dfourth = Dsquared*Dsquared;

      lambda_not = ((-180.0 + zone*6.0) -3.0) * DEGREES_TO_RADIANS;


      /* now, use the footpoint to compute the real latitude and longitude */

      var lat = footpoint - (N*tan_phi/R)*(0.5*Dsquared - (5.0 + 3.0*T + 10.0*C - 
                           4.0*Csquared - 9.0*e_prime_sq)*Dfourth/24.0 +
                           (61.0 + 90.0*T + 298.0*C + 45.0*Tsquared -
                            252.0*e_prime_sq -
                            3.0*Csquared)*Dfourth*Dsquared/720.0);
      var lon = lambda_not + (D - (1.0 + 2.0*T + C)*Dsquared*D/6.0 +
                         (5.0 - 2.0*C + 28.0*T - 3.0*Csquared + 8.0*e_prime_sq +
                          24.0*Tsquared)*Dfourth*D/120.0)/cos_phi;

       /* adds Java function returns */
       var utmll={};
       utmll={ulat:lat,ulon:lon};
       return(utmll);
   }
   return true;
}

/*------------------------------------------*/
function getoll(Form)
{
   with(Math)
   {
      /* get the origin lat and lon */
      
      var olatd =Form.LatDeg.value;
      var olatm =Form.LatMin.value;

      var olond =Form.LonDeg.value;
      var olonm =Form.LonMin.value;

      var onsdir=Form.NS.value;
      var oewdir=Form.EW.value;

      /* check origin inputs */
      if( Form.DecLat.value == "" & (Form.LatDeg.value == "" &
                                     Form.LatMin.value == "" ) )
      {
          alert('Enter latitude value for the origin');
      }
      else
      {
          if( Form.DecLat.value != "")
          { 
              olat=1.*Form.DecLat.value;  /* convert string to float*/
          }
          else
          {
              olat=deg_min_2_deg(olatd,olatm);
          }

          if (olat > 90) alert("Invalid Origin Latitude, valid range 0-90");
          if (onsdir == "S")
          {
             olat = -1*olat;
          }
      }
      if ( Form.DecLon.value == "" & (Form.LonDeg.value == "" &
                                     Form.LonMin.value == "" ) )
      {
          alert('Enter longitude value for the origin');
          return false;
      }
      else
      {
          if( Form.DecLon.value != "" )
          { 
             olon=1.*Form.DecLon.value;
          }
          else
          {
             olon=deg_min_2_deg(olond,olonm);
          }
          if (olon > 180) alert("Invalid Origin Longitude, valid range 0-180");

          if (oewdir == "W")
          {
             olon = -1*olon;
          }
      }
      var oll={};
      oll={olat:olat,olon:olon};
      return (oll);
   }
   return true;
}

/*-------------------------------------------------*/
function getsll(Form)
{
   with(Math)
   {
      /* get the input lat and lon position to be convert */
      
      var slatd =Form.SLatDeg.value;
      var slatm =Form.SLatMin.value;

      var slond =Form.SLonDeg.value;
      var slonm =Form.SLonMin.value;

      var snsdir=Form.SNS.value;
      var sewdir=Form.SEW.value;

      /* check source inputs */
      if( Form.DecSLat.value == "" & (Form.SLatDeg.value == "" &
                                     Form.SLatMin.value == "" ) )
      {
          alert('Enter latitude value to convert');
      }
      else
      {
          if ( Form.DecSLat.value != "" )
          { 
              slat=1.0*Form.DecSLat.value;
          }
          else 
          {  
             if (Form.SLatDeg.value == "" & Form.SLatMin.value == "" )
             {
                 alert('Enter latitude value to convert');
             }
             else
             {
                 slat=deg_min_2_deg(slatd,slatm);
             }
          }
          if (slat > 90) 
              alert("Invalid Latitude, valid range 0-90");

          if (snsdir == "S")
          {
              slat = -1*slat;
          }
       }
       if( Form.DecSLon.value == "" & (Form.SLonDeg.value == "" &
                                     Form.SLonMin.value == "" ) )
       {
           alert('Enter longitude value to convert');
           return false;
       }
       else
       {
           if( Form.DecSLon.value != "" )
           { 
               slon=1*Form.DecSLon.value;
           }
           else
           {

               slon=deg_min_2_deg(slond,slonm);
           }

           if (slon > 180) alert("Invalid Longitude, valid range 0-180");

           if (sewdir == "W")
           {
                slon = -1*slon;
           }
       }
       var sll={};
       sll={slat:slat,slon:slon};
       return (sll);
   }
   return true;
}

/*----------------------------------------------------------*/            

function ll2xy(Form)
{
   with(Math)
   {
      /* get the source lat and lon (to be converted) */
      var sll=getsll(Form);
      slat=sll.slat;
      slon=sll.slon;

      /* get the origin lat and lon */
      var oll=getoll(Form);
      olat=oll.olat;
      olon=oll.olon;

      var   origin={};

      origin={slat:slat, slon:slon,coord_system:1,
              olat:olat,olon:olon,xoffset_mtrs:0,
              yoffset_mtrs:0,
              rotation_angle_degs:0,rms_error:0};
      
      var ll2xy= translate_coordinates(LL_TO_XY,
origin); 
    
      /* num.toFixed() is a buildin function, 
         addCommas() is a custom function listed above */
      Form.Xcord.value=(ll2xy.x.toFixed(1));
      Form.Ycord.value=(ll2xy.y.toFixed(1));
      return true;
   }
   return true;
}                        

/*----------------------------------------------*/
function xy2ll(Form)
{
   with(Math)
   {
      /* get the origin lat and lon */
      var oll=getoll(Form);
      olat=oll.olat;
      olon=oll.olon;

     /* get the source x and y (to be converted) */
      if( Form.Xcord.value == "" | Form.Ycord.value == "")
      {
          alert('Enter X/Y values to convert');
          return false;
      }
      else
      {
         sx=1*Form.Xcord.value; /* convert string to float */
         sy=1*Form.Ycord.value;
      }

      var   origin={};

      origin={x:sx,y:sy,coord_system:1,olat:olat,
olon:olon,xoffset_mtrs:0,yoffset_mtrs:0,rotation_angle_degs:0,rms_error:0};
      
      var xy2ll= translate_coordinates(XY_TO_LL,
origin); 
    

      /* get the results and fill in the form */
      var slat=xy2ll.slat;  /* in decimal degrees */
      var slon=xy2ll.slon; 

      if (slat < 0) sns="S";else sns="N";
      if (slon < 0) sew="W";else sew="E";

      var dmlat=deg_2_deg_min(abs(slat));
      var dmlon=deg_2_deg_min(abs(slon));

      Form.DecSLat.value=abs(slat).toFixed(6);      
      Form.SLatDeg.value=dmlat.deg;      
      Form.SLatMin.value=dmlat.min.toFixed(4);

      Form.SNS.value=sns;

      Form.DecSLon.value=abs(slon).toFixed(6);
      Form.SLonDeg.value=dmlon.deg;      
      Form.SLonMin.value=dmlon.min.toFixed(4);
      Form.SEW.value=sew;
   }
   return true;
}  

/*-----------------------------------------------------------
  xy2utm (call xy2ll then geo_utm for ll2utm)  
-------------------------------------------------------------*/

function xy2utm(Form)
{
   with(Math)
   {
      /* get the origin lat and lon */
      var oll=getoll(Form);
      olat=oll.olat;
      olon=oll.olon;

     /* get the source x and y (to be converted) */
      if( Form.Xcord.value == "" | Form.Ycord.value == "")
      {
          alert('Enter X/Y values');
          return false;
      }
      else
      {
         sx=1*Form.Xcord.value; /* convert string to float */
         sy=1*Form.Ycord.value;
      }

      var   origin={};

      origin={x:sx,y:sy,coord_system:1,
              olat:olat,
olon:olon,xoffset_mtrs:0,
              yoffset_mtrs:0,rotation_angle_degs:0,rms_error:0};
      
      var xy2ll = translate_coordinates(XY_TO_LL,
origin); 

      var slat=xy2ll.slat;  /* return in degrees */
      var slon=xy2ll.slon;

      var utmzone=utm_zone(slat,slon); /* take slat and slon in degrees */

      var slat_rad=DTOR*slat;  /* decimal degrees to radius */
      var slon_rad=DTOR*slon; 

      var utmxy = geo_utm(slat_rad,slon_rad,utmzone);

      /* get the results and fill in the form */
      /* check for validity of parameters */ 
      /* out side of grid */
      if( slat >=84.0 | slat < -80.0)
      {
	  utmzone="outsideGrid";
      }

      /* get the results and fill in the form */ 
 
      Form.UTMX.value=(utmxy.x.toFixed(1));
      Form.UTMY.value=(utmxy.y.toFixed(1));
      Form.UTMZone.value=utmzone;
      return true;
   }
   return true;
}


/*-----------------------------------------------------------*/

function ll2utm(Form)
{
   with(Math)
   {
      /* get the source lat and lon (to be converted) */
      var sll=getsll(Form);

      slat=sll.slat;
      slon=sll.slon;

      /* determine the zone for the given longitude 
         with 6 deg wide longitudinal strips */

         var zone=utm_zone(slat,slon);

         var slat_rad = DTOR * slat;
         var slon_rad = DTOR * slon;

         var utmxy = geo_utm(slat_rad,slon_rad,zone);

         /* out side of grid */
         if( slat >=84.0 | slat < -80.0)
         {
	     zone="outsideGrid";
         }

         /* get the results and fill in the form */
 
         Form.UTMX.value=(utmxy.x.toFixed(1));
         Form.UTMY.value=(utmxy.y.toFixed(1));
         Form.UTMZone.value=zone;
         return true;
   }
   return true;
}

/*---------------------------------------------------------------*/
function utm2ll(Form)
{
   with(Math)
   {
      /* get the utm x and y (to be converted) */
      if( Form.UTMX.value == "" | Form.UTMY.value == "" | 
               Form.UTMZone.value == "")
      {
         alert('Enter UTM and Zone values to convert');
         return false;
      }
      else if ( Form.UTMZone.value < 1 | Form.UTMZone.value > 60)
      {
         alert('Zone is outside the valid range 1-60');
      }
      else
      {
         xx=1.0*Form.UTMX.value; 
         yy=1.0*Form.UTMY.value;
         zone=1.0*Form.UTMZone.value;
      }
      if ( Form.UNS.value == "S")
         yy = yy - FALSE_NORTHING;  /* lat < 0 */

      utmll=utm_geo(xx,yy,zone); /* return lat lon in rad*/
      
      /* convert rads to degs
  */
      ulat = RTOD*utmll.ulat;
      ulon = RTOD*utmll.ulon;
        
      /* fill in the form */

      if (ulat < 0) sns="S";else sns="N";
      if (ulon < 0) sew="W";else sew="E";

      dmlat=deg_2_deg_min(abs(ulat));
      dmlon=deg_2_deg_min(abs(ulon));

      Form.DecSLat.value=abs(ulat).toFixed(6);      
      Form.SLatDeg.value=dmlat.deg;      
      Form.SLatMin.value=dmlat.min.toFixed(4);
 
      Form.SNS.value=sns;

      Form.DecSLon.value=abs(ulon).toFixed(6);
      Form.SLonDeg.value=dmlon.deg;      
      Form.SLonMin.value=dmlon.min.toFixed(4);

      Form.SEW.value=sew;
   }
   return true;
}                        


/* -----------------------------------------------------------------*/

function utm2xy(Form)
{
   with(Math)
   {

      /* convert lat and lon to xy coordinate with origin */
      /* get the origin lat and lon */
      var oll=getoll(Form);
      olat=oll.olat;
      olon=oll.olon;

      /* get the utm x and y (to be converted) */
      if( Form.UTMX.value == "" | Form.UTMY.value == "" | 
               Form.UTMZone.value == "" )
      {
         alert('Enter UTM and Zone values to convert');
         return false;
      }
      else if ( Form.UTMZone.value < 1 | Form.UTMZone.value > 60)
      {
         alert('Zone is outside the valid range 1-60');
      }
      else
      {
         xx=1.0*Form.UTMX.value; 
         yy=1.0*Form.UTMY.value;
         zone=1.0*Form.UTMZone.value;
      }


      if ( Form.UNS.value == "S")
         yy = yy - FALSE_NORTHING;  /* lat < 0 */

      /* get the UTM lat and lon (to be converted) */
      utmll=utm_geo(xx,yy,zone); /* return lat lon in rad*/
      
      /* convert rads to degs
  */
      ulat = RTOD*utmll.ulat;
      ulon = RTOD*utmll.ulon;
    


      var origin={};

      origin={slat:ulat,slon:ulon,coord_system:1,
             olat:olat,olon:olon,xoffset_mtrs:0,
             yoffset_mtrs:0,
             rotation_angle_degs:0,rms_error:0};
      
      var ll2xy= translate_coordinates(LL_TO_XY,
origin); 
    
      /* num.toFixed() is a build in function, 
         addCommas() is a custom function listed above */
     /*  Form.Xcord.value=addCommas(ll2xy.x.toFixed(3)); */
      Form.Xcord.value=(ll2xy.x.toFixed(1));
      Form.Ycord.value=(ll2xy.y.toFixed(1));
      return true;
   }
   return true;
}                        
/*-----------------------------------------------------------*/
/* resizing_window.js  copy from the following website*/

// Cross-browser, cross-platform support for browser
// windows that auto-resize to match a specified 
// usable interior size. JavaScript code copyright 2006, 
// Boutell.Com, Inc. 
//
// See http://www.boutell.com/newfaq/ for more information.
//
// Permission granted to use, republish, sell and otherwise
// benefit from this code as you see fit, provided you keep 
// this notice intact. You may remove comments below this line.
//
// END OF NOTICE
//
// INSTRUCTIONS: this WON'T WORK unless you do the following in the
// document that includes it.
//
// 1. Specify the right doctype at the top of your page:
//
//    <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
//      "http://www.w3.org/TR/html4/strict.dtd">
//
// 2. Set the right event handlers in your body element
//    (you may call other functions too, use semicolons to separate).
//    Pass the interior width and height YOU want to resizingWindowLoaded.
//
//    <body 
//      onLoad="resizingWindowLoaded(500, 500)" 
//      onResize="resizingWindowResized()">
//
// 3. BE SURE to call resizingWindowEndOfBody() before you
// close your <body> element:
//
//      <script>
//        resizingWindowEndOfBody();
//      </script>
//    </body>
//
// And that's all it takes! 
//
// WARNINGS:
//
// 1. In my tests, the very latest version of Opera doesn't allow
//   JavaScript to resize the browser window AT ALL, even if the
//   window resizing option is enabled under 
//   Tools->Advanced->JavaScript Options. There's not much to
//   be done about that. However the code should work correctly if
//   your copy of Opera does allow resizing. Note that there is
//   also a small fudge factor to allow for a vertical scrollbar in
//   Opera, because Opera is the only browser that can't be
//   convinced to report the true interior usable space not wasted
//   by a scrollbar, and we never, ever want to force a 
//   horizontal scrollbar unnecessarily.
//
// 2. Users with JavaScript disabled won't get the resizing behavior.
//   Hey, there's no miracle cure for that! Design your page layout to
//   cope adequately if the browser window is not the expected size.

function resizingWindowIsIE()
{
	if (navigator.appName == 'Microsoft Internet Explorer') {
		return true;
	}
	return false;
}

function resizingWindowIsOpera()
{
        if (navigator.appName == 'Opera') {
                return true;
        }
        return false;
}

// We resize a maximum of three times. This allows
// the code to try to resolve any boundary conditions,
// such as scrollbars appearing or disappearing,
// in the browser's reaction to the first resize - but
// also prevents an infinite loop.

var resizingWindowMaxResizes = 3;
var resizingWindowResizes = 0;

var dwidth;
var dheight;

function resizingWindowLoaded(width, height)
{
	dwidth = width;
	dheight = height;
	resizingWindowResizes = 0;
	resizingWindowGo();
}

function resizingWindowEndOfBody()
{
	document.write("<div " +
		"id='resizingWindowTestSizeDiv' " +
		"style='width: 100%; " +
		"  height: 100%; " +
		"  position: fixed; " +
		"  left: 0; " +
		"  top: 0; " +
		"  visibility: hidden; " +
		"  z-index: -1'></div>\n");
}

function resizingWindowResized()
{
	resizingWindowGo();
}

function resizingWindowGo()
{
	// We're in "standards mode," so we must use
	// document.documentElement, not document.body, in IE.
	var width;
	var height;
	var x, y, w, h;
	if (resizingWindowResizes == resizingWindowMaxResizes) {
		return;
	}
	resizingWindowResizes++;
	// Get browser window inner dimensions
	if (resizingWindowIsIE()) {
		// All modern versions of IE, including 7, give the
		// usable page dimensions here. 
		width = parseInt(document.documentElement.clientWidth); 	
		height = parseInt(document.documentElement.clientHeight); 	
	} else if (resizingWindowIsOpera()) {
		// This is slightly off: the width and height will include
		// scrollbar space we can't really use. Compensate by
		// subtracting 16 pixels of scrollbar space from the width
		// (standard in Opera). Fortunately, in Firefox and Safari,
		// we can use a third method that gives accurate results
		// (see below).
		width = parseInt(window.innerWidth) - 16;
		// If there is a horizontal scrollbar this will be
		// 16 pixels off in Opera. I can live with that.
		// You don't design layouts on purpose with
		// horizontal scrollbars, do you? (Shudder)
		height = parseInt(window.innerHeight);
	} else {
		// Other non-IE browsers give the usable page dimensions here.
		// We grab the info by discovering the visible dimensions 
		// of a hidden 100% x 100% div. Opera doesn't like this
		// method any more than IE does. Fun!
		testsize = document.getElementById('resizingWindowTestSizeDiv');
		width = testsize.scrollWidth;
		height = testsize.scrollHeight;
	}
	// Compute the difference and add or subtract
	// space as required. Notice that we don't have to
	// know the dimensions of the toolbar, status bar, etc.
	// All we have to do is make a relative adjustment.
	if ((dwidth == width) && (dheight == height)) {
		// Don't resize anymore now that it's right!
		// We don't want to interfere with manual resize
		resizingWindowResizes = resizingWindowMaxResizes;
		return;
	}
	var xchange = dwidth - width;
	var ychange = dheight - height;
	window.resizeBy(xchange, ychange);
}




