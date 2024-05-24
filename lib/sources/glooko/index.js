/*
*
* https://github.com/jonfawcett/glooko2nightscout-bridge/blob/master/index.js#L146
* Authors:
* Jeremy Pollock
* https://github.com/jpollock
* Jon Fawcett
* and others.
*/


var qs = require('qs');
var url = require('url');


var helper = require('./convert');

_known_servers = {
  default: 'api.glooko.com'
, development: 'api.glooko.work'
, production: 'externalapi.glooko.com'
, eu: 'de-fr.api.glooko.com'
};

var Defaults = {
  "applicationId":"d89443d2-327c-4a6f-89e5-496bbb0317db"
, "lastGuid":"1e0c094e-1e54-4a4f-8e6a-f94484b53789" // hardcoded, random guid; no Glooko docs to explain need for param or why bad data works
  // v2 api for Login still used
, login: '/api/v2/users/sign_in'
, mime: 'application/json'
  // are those V2 still needed
, LatestFoods: '/api/v2/foods'
, LatestInsulins: '/api/v2/insulins'
, LatestPumpBasals: '/api/v2/pumps/scheduled_basals'
, LatestPumpBolus: '/api/v2/pumps/normal_boluses'
, LatestCGMReadings: '/api/v2/cgm/readings'
, PumpSettings: '/api/v2/external/pumps/settings'
  // added new v3api, got them frem Glooko webUI, added all I could find, even though it might not be usefull
  // ATTENTION there is a &locale=de included, has to be changed
, v3API_users: '/api/v3/session/users'
  // delivers pump and loop settings with historic values (in my case 6)
, v3API_device_and_settings: '/api/v3/devices_and_settings'
  // may it is also possible to have only 1 graph api call and combine all attributes to receive all needed data
, v3API_cgm_basal_bolus:'/api/v3/graph/data?patient=_PATIENT_&startDate=_STARTDATE_&endDate=_ENDDATE_&series[]=basalUnitsPerDay&series[]=bgAbove400&series[]=bgAbove400Manual&series[]=bgHigh&series[]=bgHighManual&series[]=bgLow&series[]=bgLowManual&series[]=bgNormal&series[]=bgNormalManual&series[]=bolusUnitsPerDay&series[]=carbAll&series[]=cgmCalibrationHigh&series[]=cgmCalibrationLow&series[]=cgmCalibrationNormal&series[]=cgmHigh&series[]=cgmLow&series[]=cgmNormal&series[]=deliveredBolus&series[]=gkInsulin&series[]=gkInsulinBasal&series[]=gkInsulinBolus&series[]=gkInsulinOther&series[]=gkInsulinPremixed&series[]=injectionBolus&series[]=totalInsulinPerDay&locale=de&insulinTooltips=false&filterBgReadings=false'
  // no sample data so far
, v3API_exercise_data:'/api/v3/graph/exercise_data?patient=_PATIENT_&startDate=_STARTDATE_&endDate=_ENDDATE_&series[]=steps'
  // need to check more detailed it is only ease off and boost
, v3API_basal_easeoff_boost: '/api/v3/graph/data?patient=_PATIENT_&startDate=_STARTDATE_&endDate=_ENDDATE_&series[]=automaticBolus&series[]=basalBarAutomated&series[]=basalBarAutomatedMax&series[]=basalBarAutomatedSuspend&series[]=basalLabels&series[]=basalModulation&series[]=pumpAdvisoryAlert&series[]=pumpAlarm&series[]=pumpBasaliqAutomaticMode&series[]=pumpBasaliqManualMode&series[]=pumpCamapsAutomaticMode&series[]=pumpCamapsBluetoothTurnedOffMode&series[]=pumpCamapsBoostMode&series[]=pumpCamapsDepoweredMode&series[]=pumpCamapsEaseOffMode&series[]=pumpCamapsExtendedBolusNotAllowedMode&series[]=pumpCamapsManualMode&series[]=pumpCamapsNoCgmMode&series[]=pumpCamapsNoPumpConnectivityMode&series[]=pumpCamapsPumpDeliverySuspendedMode&series[]=pumpCamapsUnableToProceedMode&series[]=pumpControliqAutomaticMode&series[]=pumpControliqExerciseMode&series[]=pumpControliqManualMode&series[]=pumpControliqSleepMode&series[]=pumpGenericAutomaticMode&series[]=pumpGenericManualMode&series[]=pumpOp5AutomaticMode&series[]=pumpOp5HypoprotectMode&series[]=pumpOp5LimitedMode&series[]=pumpOp5ManualMode&series[]=reservoirChange&series[]=scheduledBasal&series[]=setSiteChange&series[]=suggestedBolus&series[]=suggestedBolus&series[]=suspendBasal&series[]=temporaryBasal&series[]=unusedScheduledBasal&locale=de&insulinTooltips=true&filterBgReadings=true'
};

function base_for (spec) {
  var server = spec.glookoServer ? spec.glookoServer : _known_servers[spec.glookoEnv || 'default' ];
  var base = {
    protocol: 'https',
    host: server
  };
  return url.format(base);
}

// random ID for header data deviceID and serialNumber, instead of UID
function generateRandomID(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function login_payload (opts) {
  var body = {
    "userLogin": {
      "email": opts.glookoEmail,
      "password": opts.glookoPassword
    },
    "deviceInformation": {
      "applicationType": "logbook",
      "os": "android",
      "osVersion": "33",
      "device": "Google Pixel 4a",
      "deviceManufacturer": "Google",
      "deviceModel": "Pixel 4a",
      "serialNumber": generateRandomID(18),
      "clinicalResearch": false,
      "deviceId": generateRandomID(16),
      "applicationVersion": "6.1.3",
      "buildNumber": "0",
      "gitHash": "g4fbed2011b"
    }
  };
  return body;
}

// ATTENTION: Referer is hardcoded to de-fr
function glookoSource (opts, axios) {
  var default_headers = { 'Content-Type': Defaults.mime,
                          'Accept': 'application/json, text/plain, */*',
                          'Accept-Encoding': 'gzip, deflate, br',
                          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
                          'Referer': 'https://de-fr.my.glooko.com/',
                          'Origin': 'https://my.glooko.com',
                          'Connection': 'keep-alive',
                          'Accept-Language': 'en-GB,en;q=0.9'
                          };
  var baseURL = opts.baseURL;
  //console.log('GLOOKO OPTS', opts);
  var http = axios.create({ baseURL, headers: default_headers });
  var impl = {
    authFromCredentials ( ) {
      var payload = login_payload(opts);
      return http.post(Defaults.login, payload).then((response) => {
        //console.log("GLOOKO AUTH", response.headers, response.data);
        return { cookies: response.headers['set-cookie'][0], user: response.data };
      });
    },
    sessionFromAuth (auth) {
      return Promise.resolve(auth);
    },
    dataFromSesssion (session, last_known) {
      var two_days_ago = new Date( ).getTime( ) - (2 * 24 * 60 * 60 * 1000);
      // added a one day option
      var twentytwoHoursAgo = new Date( ).getTime( ) - (1 * 22 * 60 * 60 * 1000);
      //console.log('last_known: ', last_known);
      //console.log('last_known.entries: ', last_known.entries);
      //console.log('last_known.entries as Time: ', last_known.entries.getTime( ));
      var last_mills = Math.max(twentytwoHoursAgo, (last_known && last_known.entries) ? last_known.entries.getTime( ) : twentytwoHoursAgo);
      console.log('last_mills: ', last_mills);
      var last_glucose_at = new Date(last_mills);
      var maxCount = Math.ceil(((new Date( )).getTime( ) - last_mills) / (1000 * 60 * 5));
      var minutes = 5 * maxCount;
      var lastUpdatedAt = last_glucose_at.toISOString( );
      var body = { };
      var params = {
        // revoved for V3API
        /*lastGuid: Defaults.lastGuid,
        lastUpdatedAt,
        limit: maxCount,*/
      };

      // ATTENTION HOST de-fr Hardcoded
      function fetcher (endpoint) {
        var headers = default_headers;
        headers["Cookie"] = session.cookies;
        headers["Host"] = "de-fr.api.glooko.com";
        headers["Sec-Fetch-Dest"] = "empty";
        headers["Sec-Fetch-Mode"] = "cors";
        headers["Sec-Fetch-Site"] = "same-site";
        //console.log('GLOOKO FETCHER LOADING', endpoint);
        return http.get(endpoint, { headers, params })
          .then((resp) => resp.data);
      }

      // 2023-06-11T00:00:00.000Z
      // 2023-06-11T23:59:59.999Z

      const myDate = new Date();
      const dateString = myDate.getFullYear() + '-'
         + ('0' + (myDate.getMonth()+1)).slice(-2) + '-'
        + ('0' + myDate.getDate()).slice(-2);

      /*
      console.log('SESSION USER', session.user);
      let v3APIURL = Defaults.v3API.replace('_PATIENT_',session.user.userLogin.glookoCode).replace('_STARTDATE_', dateString + "T00:00:00.000Z").replace('_ENDDATE_', dateString + 'T23:59:59.999Z');
      */      
      function constructUrl(endpoint) {
        //?patient=orange-waywood-8651&startDate=2020-01-08T06:07:00.000Z&endDate=2020-01-09T06:07:00.000Z
        const myDate = new Date();
        const startDate = new Date(twentytwoHoursAgo); // myDate.getTime() - 6 * 60 * 60 * 1000);

        const url = endpoint + "?patient=" + session.user.userLogin.glookoCode
         + "&startDate=" + startDate.toISOString()
         + "&endDate=" + myDate.toISOString();

        return url;
      }

      // added for using V3 API
      function constructUrlV3API (endpoint) {
        const myDate = new Date();
        const dateString = myDate.getFullYear() + '-'
         + ('0' + (myDate.getMonth()+1)).slice(-2) + '-'
        + ('0' + myDate.getDate()).slice(-2);
        const startDate = new Date(twentytwoHoursAgo); // myDate.getTime() - 6 * 60 * 60 * 1000);

        let url = endpoint.replace('_PATIENT_', session.user.userLogin.glookoCode);
        // It seems like it retuns only max 24 hours chunks... so I start with TS - 22 hours 
        url = url.replace('_STARTDATE_', startDate.toISOString());
        url = url.replace('_ENDDATE_',  dateString + 'T23:59:59.999Z');

        return url;
      }

      return Promise.all([
        // could be reduced to one call maybe
        fetcher(constructUrlV3API(Defaults.v3API_cgm_basal_bolus)),
        fetcher(constructUrlV3API(Defaults.v3API_basal_easeoff_boost)),
        fetcher(constructUrl(Defaults.v3API_device_and_settings)),
        ]).then(function (results) {
          //console.log("these are the returned results: ");
          //console.log(results);
          var some = {
            // all data is collected from glooko but only tested for dana pumps so far!
            // contains all boluses including correction, no need of matchtichng between insulin and food.
            normalBoluses: results[0].series.deliveredBolus,
            //cgm_reading: [results[0].series.cgmHigh, results[0].series.cgmNormal, results[0].series.cgmLow],
            cgm_reading: [...results[0].series.cgmHigh, ...results[0].series.cgmNormal, ...results[0].series.cgmLow],

            // loop basal, configured pump basal also included
            basal: results[1].series,
            scheduledBasals: results[1].series.scheduledBasal,
            // settings of camaps and pump 
            settings: results[2]
         };

         //console.log('cgm high sample sample', JSON.stringify(some.v3API_cgm_basal_bolus_results_cgmHighs[5]));
         //console.log('cgm normal sample sample', JSON.stringify(some.v3API_cgm_basal_bolus_results_cgmNormals[5]));
         //console.log('cgm low sample sample', JSON.stringify(some.v3API_cgm_basal_bolus_results_cgmLows[5]));
         //console.log('basal ease off sample', JSON.stringify(some.v3API_basal_easeoff_boost_results[0]));
         //console.log('device settings sample', JSON.stringify(some.v3API_device_and_settings_reults[0]));

          //console.log('GLOOKO DATA FETCH', results, some);
          //console.log('GOT RESULTS FROM GLOOKO', results);
          return some;
        });
    },
    align_to_glucose ( ) {
      // TODO
    },
    transformData (batch) {
      // working for loop basal and boluses
      //console.log('GLOOKO passing batch for treatments transforming');
      //console.log("TODO TRANSFORM", batch);
      var treatments = helper.generate_nightscout_treatments(batch, opts.glookoTimezoneOffset);
      //console.log('GLOOKO passing batch for entries transforming');
      var entries = helper.generate_nightscout_entries(batch.cgm_reading, opts.glookoTimezoneOffset);
      return { entries, treatments };
    },
  };
  function tracker_for ( ) {
    // var { AxiosHarTracker } = require('axios-har-tracker');
    // var tracker = new AxiosHarTracker(http);
    var AxiosTracer = require('../../trace-axios');
    var tracker = AxiosTracer(http);
    return tracker;
  }
  function generate_driver (builder) {
    builder.support_session({
      authenticate: impl.authFromCredentials,
      authorize: impl.sessionFromAuth,
      // refresh: impl.refreshSession,
      delays: {
        REFRESH_AFTER_SESSSION_DELAY: (1000 * 60 * 60 * 24 * 1) - 600000,
        EXPIRE_SESSION_DELAY: 1000 * 60 * 60 * 24 * 1,
      }
    });

    builder.register_loop('Glooko', {
      tracker: tracker_for,
      frame: {
        impl: impl.dataFromSesssion,
        align_schedule: impl.align_to_glucose,
        transform: impl.transformData,
        backoff: {
        // wait 2.5 minutes * 2^attempt
          interval_ms: 2.5 * 60 * 1000

        },
        // only try 3 times to get data
        maxRetries: 1
      },
      // expect new data 5 minutes after last success
      expected_data_interval_ms: 5 * 60 * 1000,
      backoff: {
        // wait 2.5 minutes * 2^attempt
        interval_ms: 2.5 * 60 * 1000
      },
    });
    return builder;
  }
  impl.generate_driver = generate_driver;
  return impl;
}

glookoSource.validate = function validate_inputs (input) {
  var ok = false;
  var baseURL = base_for(input);

  const offset = !isNaN(input.glookoTimezoneOffset) ? input.glookoTimezoneOffset * -60 * 60 * 1000 : 0
  console.log('GLOOKO using ms offset:', offset, ' based on input:', input.glookoTimezoneOffset);

  var config = {
    glookoEnv: input.glookoEnv,
    glookoServer: input.glookoServer,
    glookoEmail: input.glookoEmail,
    glookoPassword: input.glookoPassword,
    glookoTimezoneOffset: offset,
    baseURL
  };
  var errors = [ ];
  if (!config.glookoEmail) {
    errors.push({desc: "The Glooko User Login Email is required.. CONNECT_GLOOKO_EMAIL must be an email belonging to an active Glooko User to log in.", err: new Error('CONNECT_GLOOKO_EMAIL') } );
  }
  if (!config.glookoPassword) {
    errors.push({desc: "Glooko User Login Password is required. CONNECT_GLOOKO_PASSWORD must be the password for the Glooko User Login.", err: new Error('CONNECT_GLOOKO_PASSWORD') } );
  }
  ok = errors.length == 0;
  config.kind = ok ? 'glooko' : 'disabled';
  return { ok, errors, config };
}
module.exports = glookoSource;
