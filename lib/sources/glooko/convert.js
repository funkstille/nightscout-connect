var moment = require('moment');


function generate_nightscout_entries(batch, timestampDelta) {
      // sgv
      // bg - no sample data so far "bgHigh": [],"bgNormal": [],"bgLow": [],"bgAbove400": [],"bgHighManual": [],"bgNormalManual": [],"bgLowManual": [],"bgAbove400Manual": [],
  //console.log("Diese Entrie Batch Daten habe ich erhalten: ");
  //console.log(batch);

  // at the moment we only have cgm readings so batch is fine
  const cgmReadings = batch;
  var entries = []
  if (cgmReadings) {
    cgmReadings.forEach(function(element) {
      var entrie = {};
  
      //console.log(element);
      /*
      
      // sample nightscout data from source xDrip Companion
      {
        "_id": "664ca53c624e3beca6668c01",
        "device": "xDrip-UiBased",
        "date": 1716299063808,
        "dateString": "2024-05-21T13:44:23.808Z",
        "sgv": 243,
        "delta": 4.01,
        "direction": "Flat",
        "type": "sgv",
        "filtered": 0,
        "unfiltered": 0,
        "rssi": 100,
        "noise": 1,
        "sysTime": "2024-05-21T13:44:23.808Z",
        "utcOffset": 120,
        "mills": 1716299063808
    },
    glooko
                            {
                              "x": 1716214748,
                              "y": 133,
                              "mealTag": "none",
                              "value": 13301,
                              "timestamp": "2024-05-20T14:19:08.000Z",
                              "calculated": false
                          },
    
    */
      //var f_date = moment(element.timestamp);
      entrie.eventType = 'sgv';
      entrie.sgv = element.y;
      entrie.device = "ns-connect from glooko";
      entrie.dateString = element.timestamp;
      entrie.date = element.x;
      entrie.sysTime = element.timestamp;
      // offset in Minutes
      entrie.utcOffset = timestampDelta / (-60 * 1000);
      //entrie.direction;
      entries.push(entrie);
    })
  }

  console.log('GLOOKO data transformation complete, returning', entries.length, 'entries');
  
  return entries;
}
  

function generate_nightscout_treatments(batch, timestampDelta) {
      // Snack Bolus - no sample data so far
      // Meal Bolus - done
      // BG Check - not implementet 
      // Correction Bolus - done
      // Carb Correction - done
  /*
  var foods = entries['foods']['foods']; //ugh
  var insulins = entries['insulins']['insulins'];
  var pumpBoluses = entries['pumpBoluses']['normalBoluses']
  */
  //console.log("Diese Batch Daten habe ich erhalten: ");
  //console.log(batch);
  const foods = batch.foods;
  const insulins = batch.insulins;
  const pumpBoluses = batch.normalBoluses;
  const scheduledBasals = batch.scheduledBasals;
  //const cgmReadings = batch.cgm_reading;
  
  var treatments = []

  // not needed anymore for CamAPS ???    
  if (foods) {
    foods.forEach(function(element) {


  /*
  // example data
                    "carbAll": [
                        {
                            "name": "Pumps Normal Bolus",
                            "carbs": 30,
                            "timestamp": "2024-05-20T12:08:00.000Z",
                            "x": 1716206880,
                            "y": 50,
                            "yOrig": 30
                        },  
  */
  
  
      var treatment = {};

      //console.log(element);
      var f_date = new Date(element.timestamp);
      var f_s_date = new Date(f_date.getTime()  + timestampDelta - 45*60000);
      var f_e_date = new Date(f_date.getTime()  + timestampDelta + 45*60000);

      var now = moment(f_date); //todays date
      var end = moment(f_s_date); // another date
      var duration = moment.duration(now.diff(end));
      var minutes = duration.asMinutes();

      var i_date = new Date();
      var result = insulins.filter(function(el) {
          i_date = new Date(el.timestamp);
          var i_moment = moment(i_date);
          var duration = moment.duration(now.diff(i_moment));
          var minutes = duration.asMinutes();
          return Math.abs(minutes) < 46;

      })
          
      // not needed anymore for CamAPS ???
      insulin = result[0];
      if (insulin != undefined) {
        var i_date = moment(insulin.timestamp);
        treatment.eventType = 'Meal Bolus';
        // 4 hours * 60 minutes per hour * 60 seconds per minute * 1000 millseconds
        treatment.eventTime = new Date(i_date ).toISOString( );
        //treatment.eventTime = new Date(i_date).toISOString( );
        //treatment.eventTime = i_date.toISOString( );
        //treatment.insulin = insulin.value;
        treatment.insulin = insulin.insulinDelivered;
        

        treatment.preBolus = moment.duration(moment(f_date).diff(moment(i_date))).asMinutes();
      } else {
        var f_date = moment(element.timestamp);
        treatment.eventType = 'Carb Correction';
        treatment.eventTime = new Date(f_date ).toISOString( );
        //treatment.eventTime = new Date(f_date).toISOString( );
        //treatment.eventTime = f_date.toISOString( );
      }

      treatment.carbs = element.carbs;
      treatment.notes = JSON.stringify(element);
      
      treatments.push(treatment);
      //console.log(treatment)

    });    
  }

  if (insulins) {
    insulins.forEach(function(element) {
      var treatment = {};

      //console.log(element);
      var f_date = new Date(element.timestamp);
      var f_s_date = new Date(f_date.getTime() + timestampDelta - 5*60000);
      var f_e_date = new Date(f_date.getTime() + timestampDelta + 5*60000);

      var now = moment(f_date); //todays date
      var end = moment(f_s_date); // another date
      var duration = moment.duration(now.diff(end));
      var minutes = duration.asMinutes();

      var i_date = new Date();
      var result = foods.filter(function(el) {
          i_date = new Date(el.timestamp);
          var i_moment = moment(i_date);
          var duration = moment.duration(now.diff(i_moment));
          var minutes = duration.asMinutes();
          return Math.abs(minutes) < 46;

      })
      //console.log(result);
      if (result[0] == undefined) {
        var f_date = moment(element.timestamp);
        treatment.eventType = 'Correction Bolus';
        treatment.eventTime = new Date(f_date).toISOString( );
        //treatment.insulin = element.value;
        treatment.insulin = element.insulinDelivered;
        //treatment.eventTime = f_date.toISOString( );
        treatments.push(treatment);
      }
    });    
  }
      
// for CamAPSFX Glooko Data it seems to be enogh to only use deliveredBoluses, no need to combine insulin and food, do I miss something ;)
  if (pumpBoluses) {
    pumpBoluses.forEach(function(element) {
            /*
            // example data
                    "deliveredBolus": [
                        {
                            "isInterrupted": false,
                            "isOverrideBelow": false,
                            "isOverrideAbove": false,
                            "isManual": false,
                            "x": 1716206880,
                            "y": 1.9,
                            "carbsInput": 30,
                            "insulinDelivered": 1.9,
                            "totalInsulinRecommendation": 1.9,
                            "insulinProgrammed": 1.9,
                            "insulinRecommendationForCorrection": null,
                            "insulinRecommendationForCarbs": 1.9,
                            "insulinOnBoard": null,
                            "initialDelivery": null,
                            "extendedDelivery": null,
                            "extendedBolusDuration": null,
                            "initialDeliveryPercentage": null,
                            "extendedDeliveryPercentage": null,
                            "highestBolusValue": 1.9,
                            "timestamp": "2024-05-20T12:08:00.000Z",
                            "durationString": null,
                            "presetVolume": null,
                            "bloodGlucoseInput": null,
                            "bloodGlucoseInputSource": null,
                            "isUnknownComboBolus": null
                        },
    {
    // Carb Correction and Combo Bolus the only difference is that Combo Bolus is repeatet 6 Times   
    Carb Correction
      {"isInterrupted":false,"isOverrideBelow":false,"isOverrideAbove":false,"isManual":true,"x":1716437845,"y":0,"carbsInput":4,"insulinDelivered":0,"totalInsulinRecommendation":0,"insulinProgrammed":0,"insulinRecommendationForCorrection":null,"insulinRecommendationForCarbs":null,"insulinOnBoard":null,"initialDelivery":null,"extendedDelivery":null,"extendedBolusDuration":null,"initialDeliveryPercentage":null,"extendedDeliveryPercentage":null,"highestBolusValue":0,"timestamp":"2024-05-23T04:17:25.000Z","durationString":null,"presetVolume":null,"bloodGlucoseInput":null,"bloodGlucoseInputSource":null,"isUnknownComboBolus":null}'
    Combo Bolus (6 Times)
      {"isInterrupted":false,"isOverrideBelow":false,"isOverrideAbove":false,"isManual":true,"x":1716327094,"y":0,"carbsInput":2.5,"insulinDelivered":0,"totalInsulinRecommendation":0,"insulinProgrammed":0,"insulinRecommendationForCorrection":null,"insulinRecommendationForCarbs":null,"insulinOnBoard":null,"initialDelivery":null,"extendedDelivery":null,"extendedBolusDuration":null,"initialDeliveryPercentage":null,"extendedDeliveryPercentage":null,"highestBolusValue":0,"timestamp":"2024-05-21T21:31:34.000Z","durationString":null,"presetVolume":null,"bloodGlucoseInput":null,"bloodGlucoseInputSource":null,"isUnknownComboBolus":null}
        
      
          if (parseFloat(element.carbsInput) > 0 && parseFloat(element.insulinDelivered) == 0 && element.isManual == true){
        // how to handle that separated information from Glooko / camaps (6 treatments).
        // For now we use 6 treatments then and a duration of 30 minutes each. Later maybe we filter the the last 5 and include it into 1 larger
        treatment.eventType = 'Combo Bolus';
        treatment.splitNow = 100;
        treatment.splitExt = 0;
        treatment.duration = 30;
    } else 

      */
      
      
      var treatment = {};

      //console.log(element);
      
      var f_date = moment(element.timestamp);
      treatment.eventTime = new Date(f_date + timestampDelta).toISOString( );
      
    if (parseFloat(element.carbsInput) == 0 && parseFloat(element.insulinDelivered) > 0){
      treatment.eventType = 'Correction Bolus';
     } else if (parseFloat(element.carbsInput) > 0 && parseFloat(element.insulinDelivered) == 0) {
      treatment.eventType = 'Carb Correction';
     } else {
      treatment.eventType = 'Meal Bolus';
     }
      treatment.insulin = element.insulinDelivered;
      treatment.carbs = element.carbsInput;
      treatment.notes = JSON.stringify(element);
      treatments.push(treatment);
    })
  }

  /*
  // example data
                    "scheduledBasal": [
                        {
                            "rate": 0,
                            "duration": 1125,
                            "timestamp": "2024-05-20T12:55:31.155Z",
                            "endTimestamp": "2024-05-20T13:14:16.155Z",
                            "startTime": 43823,
                            "durationString": "12:55pm to  1:14pm",
                            "x": 1716209731,
                            "y": 0,
                            "interpolated": false,
                            "displayTooltip": true,
                            "unused": false
                        },
  */
  if (scheduledBasals) {
    scheduledBasals.forEach(function(element) {
      var treatment = {};

      //console.log(element);
      
      var f_date = moment(element.timestamp);
      treatment.eventType = 'Temp Basal';
      treatment.created_at = new Date(f_date + timestampDelta).toISOString( );
      treatment.rate = element.rate;
      treatment.absolute = element.rate;
      treatment.duration = element.duration / 60;
      treatment.notes = JSON.stringify(element);
      //treatment.eventTime = f_date.toISOString( );
      treatments.push(treatment);
    })
  }


console.log('GLOOKO data transformation complete, returning', treatments.length, 'treatments');

return treatments;
}


module.exports.generate_nightscout_treatments = generate_nightscout_treatments;
module.exports.generate_nightscout_entries = generate_nightscout_entries;
