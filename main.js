/* jshint -W097 */// jshint strict:false
/*jslint node: true */

"use strict";
var utils       = require(__dirname + '/lib/utils'); // Get common adapter utils
var request     = require('request');
var lang = 'de';

var adapter = utils.adapter({
    name:           'solarwetter',
    systemConfig:   true,
    useFormatDate:  true
});

var plz;
var link;

var logging = true;

var idClearSky =   'forecast.clearSky',
    idRealSkyMin = 'forecast.realSky_min',
    idRealSkyMax = 'forecast.realSky_max',
    idDatum =      'forecast.Datum',
    idPLZ =        'forecast.Region';
    
adapter.on('ready', function () {
    adapter.getForeignObject('system.config', function (err, data) {
        if (data && data.common) {
            lang  = data.common.language;
        }

        adapter.log.debug('initializing objects');
        main();
        adapter.log.info('objects written');

        setTimeout(function () {
            adapter.log.info('force terminating adapter after 1 minute');
            adapter.stop();
        }, 60000);

    });
});


function readSettings() {
    plz = adapter.config.location;
    if (plz === undefined || plz === 0) {
        adapter.log.info('Keine Region ausgewählt'); // Translate!
        
    } else {
        adapter.log.info('Postcode: '+ plz);
        adapter.setState(idPLZ, plz, true);
    }
} 

function erstes_erstesAuftauchen(body,text1,text2) {
    var start = body.indexOf(text1) + text1.length;
    var ende = body.indexOf(text2);
    if (logging) adapter.log.debug('Startposition: ' + start);
    if (logging) adapter.log.debug('Endposition: ' + ende);
    var zwischenspeicher;
    if (((start != -1) && (ende != -1)) && (start<ende)) {                      // Fehler abfangen
        zwischenspeicher = body.slice(start,ende);
        if (logging) adapter.log.debug(zwischenspeicher);
        var zwischenspeicher_array =  zwischenspeicher.split(',');              // Teilen vorm Komma
        var zwischenspeicher_array_vorn = zwischenspeicher_array[0].slice(zwischenspeicher_array[0].length-1,zwischenspeicher_array[0].length); // eine Stelle vorm Komma
        if (logging) adapter.log.debug(zwischenspeicher_array_vorn);
        var zwischenspeicher_array_hinten = zwischenspeicher_array[1].slice(0,2);   // zwei Stellen nach dem Komma
        if (logging) adapter.log.debug(zwischenspeicher_array_hinten);
        return(parseFloat(zwischenspeicher_array_vorn + '.' + zwischenspeicher_array_hinten));
    } else {
        zwischenspeicher = 'Fehler beim Ausschneiden';
        adapter.log.error(zwischenspeicher);
        return(0);
    }
}

function erstes_letztesAuftauchen(body,text1,text2) {
    var start = body.indexOf(text1) + text1.length;
    var ende = body.lastIndexOf(text2);                                         // letztes Auftauchen
    if (logging) adapter.log.debug('Startposition: ' + start);
    if (logging) adapter.log.debug('Endposition: ' + ende);
    var zwischenspeicher;
    if (((start != -1) && (ende != -1)) && (start<ende)) {                      // Fehler abfangen
        zwischenspeicher = body.slice(start,ende);
        if (logging) adapter.log.debug(zwischenspeicher);
        var zwischenspeicher_array =  zwischenspeicher.split(',');              // Teilen vorm Komma
        var zwischenspeicher_array_vorn = zwischenspeicher_array[0].slice(zwischenspeicher_array[0].length-1,zwischenspeicher_array[0].length); // eine Stelle vorm Komma
        if (logging) adapter.log.debug(zwischenspeicher_array_vorn);
        var zwischenspeicher_array_hinten = zwischenspeicher_array[1].slice(0,2);   // zwei Stellen nach dem Komma
        if (logging) adapter.log.debug(zwischenspeicher_array_hinten);
        return(parseFloat(zwischenspeicher_array_vorn + '.' + zwischenspeicher_array_hinten));
    } else {
        zwischenspeicher = 'Fehler beim Ausschneiden';
        adapter.log.error(zwischenspeicher);
        return(0);
    }
}

function loeseDatum (body,text1) {
    var start = body.indexOf(text1) - 5;
    var ende = body.indexOf(text1) + 5;                                         // xx.xx.xxxx
    if (logging) adapter.log.debug('Startposition: ' + start);
    if (logging) adapter.log.debug('Endposition: ' + ende);
    var zwischenspeicher;
    if ((start != -1) && (ende != -1)) {                                        // Fehler abfangen
        zwischenspeicher = body.slice(start,ende);
        var datum_array = zwischenspeicher.split('.');
        var xDatum = new Date();
        if (logging) adapter.log.debug('Tag: ' + datum_array[0]);
        if (logging) adapter.log.debug('Monat: ' + datum_array[1]);
        if (logging) adapter.log.debug('Jahr: ' + datum_array[2]);
        xDatum.setDate(datum_array[0]);
        xDatum.setMonth(datum_array[1]-1);
        xDatum.setFullYear(datum_array[2]);
        if (logging) adapter.log.debug(xDatum);
        //return(formatDate(xDatum, "TT.MM.JJJJ"));
        var xDatum_workaround = (xDatum.getDate() <10 ? '0' + xDatum.getDate() : xDatum.getDate() ) + '.' + (xDatum.getMonth()+1 <10 ? '0' + (xDatum.getMonth()+1) : xDatum.getMonth()+1) + '.' + xDatum.getFullYear(); 
        return(xDatum_workaround);
        
    } else {
        zwischenspeicher = 'Fehler beim Ausschneiden';
        adapter.log.error(zwischenspeicher);
        return(null);
    }
}

function findeWertClearsky (body) {   
    var text1 = "<td height=17 class=xl1525883 style='height:12.75pt'>clear sky:</td>", // erstes Auftauchen
        text2 = "<td class=xl2425883>kWh/kWp</td>";                 // erstes Auftauchen
    var clearsky = erstes_erstesAuftauchen(body,text1,text2);
    if (logging) adapter.log.debug('ClearSky: ' + clearsky);
    adapter.setState(idClearSky, {ack: true, val: clearsky});                         // Wert in Objekt schreiben
}

function findeWertRealskyMinimum (body) {   
    var text1 = "real sky:</td>",                                   // erstes Auftauchen
        text2 = "<td class=xl2725883>-</td>";                       // erstes Auftauchen
    var realsky_min = erstes_erstesAuftauchen(body,text1,text2);
    if (logging) adapter.log.debug('RealSkyMinimum: ' + realsky_min);
    adapter.setState(idRealSkyMin, {ack: true, val: realsky_min});                    // Wert in Objekt schreiben
}
 
function findeWertRealskyMaximum (body) {   
    var text1 = "<td class=xl2725883>-</td>",                       // erstes Auftauchen
        text2 = "<td class=xl2425883>kWh/kWp</td>";                 // letztes Auftauchen
    var realsky_max = erstes_letztesAuftauchen(body,text1,text2);
    if (logging) adapter.log.debug('RealSkyMaximum: ' + realsky_max);
    adapter.setState(idRealSkyMax, {ack: true, val: realsky_max});                    // Wert in Objekt schreiben
}

function findeDatum (body) {   
    var jetzt = new Date();
    var Jahr = jetzt.getFullYear();                                 // aktuelles Jahr ermitteln
    var text1 = '.'+ Jahr +'</td>';                                 // erstes Auftauchen vom aktuellen Jahr finden
    var datum = loeseDatum(body,text1);
    if (logging) adapter.log.debug('Datum: ' + datum);
    adapter.setState(idDatum, {ack: true, val: datum});                                       // Wert in Objekt schreiben
}

function leseWebseite () {
    var link = 'http://www.vorhersage-plz-bereich.solar-wetter.com/html/' + plz + '.html';
    if (!plz || plz.length < 3) {
        adapter.log.warn('Kein PLZ-Bereich festgelegt. Adapter wird angehalten');
        adapter.stop;
    }
    try {
        request(link, function (error, response, body) {
            if (!error && response.statusCode == 200) {              // kein Fehler, Inhalt in body
                findeWertClearsky(body);
                findeWertRealskyMinimum(body);
                findeWertRealskyMaximum(body);
                findeDatum(body);
            } else adapter.log.error(error);                               // Error beim Einlesen
        });
    } catch (e) {
        adapter.log.error('Fehler (try) leseWebseite: ' + e);
    }   
}

function main() {
    readSettings();
    leseWebseite();
    adapter.stop();
}
