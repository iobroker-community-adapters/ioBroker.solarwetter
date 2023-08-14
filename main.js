const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const axios = require('axios');
let lang = 'de';

const adapter = utils.Adapter({
    name: 'solarwetter',
    systemConfig: true,
    useFormatDate: true
});

let plz;
let city;
let power;
/* removed username & password 2022/03 */

const logging = false;

const idClearSky = 'forecast.clearSky';
const idRealSkyMin = 'forecast.realSky_min';
const idRealSkyMax = 'forecast.realSky_max';
const idDatum = 'forecast.Datum';
const idPLZ = 'forecast.Region';
const idPrognose = 'forecast.chart.city';
const idPrognoseURL = 'forecast.chart.url';
const idHomeAnlage = 'forecast.home.Leistung';
const idHomeClearSky = 'forecast.home.clearSky';
const idHomeRealSkyMin = 'forecast.home.realSky_min';
const idHomeRealSkyMax = 'forecast.home.realSky_max';

adapter.on('ready', () => {
    adapter.getForeignObject('system.config', (err, data) => {
        if (data && data.common) {
            lang = data.common.language;
        }

        adapter.log.debug('initializing objects');
        main();

        setTimeout(function () {
            adapter.log.info('force terminating adapter after 1 minute');
            adapter.stop();
        }, 60000);

    });
});


function readSettings() {
    plz = adapter.config.location;
    if (plz === undefined || plz === 0 || plz === 'select') {
        adapter.log.warn('Keine Region ausgewählt'); // Translate!
        adapter.stop();
    } else {
        adapter.log.info(`Postcode: ${plz}`);
        adapter.setState(idPLZ, plz, true);
    }
    city = adapter.config.prognoseort;
    if (!city || city.search(/(- )\b\b/gmi) !== -1) {
        adapter.log.warn('Keine Stadt für eine 4-Tage-Prognose ausgewählt'); // Translate!
        adapter.stop();
    } else {
        adapter.log.info(`4-Tage-Prognose für: ${city}`);
        adapter.setState(idPrognose, city, true);
        adapter.setState(idPrognoseURL, `http://www.solar-wetter.com/assets/${city}%20Vorhersage-Diagramm.GIF`, true);
        adapter.log.debug(`URL für Bild: http://www.solar-wetter.com/assets/${city}%20Vorhersage-Diagramm.GIF`);
    }

    power = adapter.config.power;
    if (power === undefined || power === 0) {
        adapter.log.warn('Keine Leistung für die eigene Anlage angegeben'); // Translate!
        power = 0;
    } else {
        adapter.log.info(`Leistung eigene Anlage: ${power} kWp`);
    }
    adapter.setState(idHomeAnlage, parseFloat(power), true);


    leseWebseite();
}

function erstes_erstesAuftauchen(body, text1, text2) {
    const start = body.indexOf(text1) + text1.length;
    const ende = body.indexOf(text2);
    logging && adapter.log.debug(`Startposition: ${start}`);
    logging && adapter.log.debug(`Endposition: ${ende}`);
    let zwischenspeicher;
    if (start !== -1 && ende !== -1 && start < ende) {                      // Fehler abfangen
        zwischenspeicher = body.slice(start, ende);
        logging && adapter.log.debug(zwischenspeicher);
        const zwischenspeicher_array = zwischenspeicher.split(',');              // Teilen vorm Komma
        const zwischenspeicher_array_vorn = zwischenspeicher_array[0].slice(zwischenspeicher_array[0].length - 1, zwischenspeicher_array[0].length); // eine Stelle vorm Komma
        logging && adapter.log.debug(zwischenspeicher_array_vorn);
        const zwischenspeicher_array_hinten = zwischenspeicher_array[1].slice(0, 2);   // zwei Stellen nach dem Komma
        logging && adapter.log.debug(zwischenspeicher_array_hinten);
        return parseFloat(`${zwischenspeicher_array_vorn}.${zwischenspeicher_array_hinten}`);
    }

    zwischenspeicher = 'Fehler beim Ausschneiden';
    adapter.log.error(zwischenspeicher);
    adapter.stop();
    return 0;
}

function erstes_letztesAuftauchen(body, text1, text2) {
    const start = body.indexOf(text1) + text1.length;
    const ende = body.lastIndexOf(text2);                                         // letztes Auftauchen
    logging && adapter.log.debug(`Startposition: ${start}`);
    logging && adapter.log.debug(`Endposition: ${ende}`);
    let zwischenspeicher;
    if (start !== -1 && ende !== -1 && start < ende) {                      // Fehler abfangen
        zwischenspeicher = body.slice(start, ende);
        logging && adapter.log.debug(zwischenspeicher);
        const zwischenspeicher_array = zwischenspeicher.split(',');              // Teilen vorm Komma
        const zwischenspeicher_array_vorn = zwischenspeicher_array[0].slice(zwischenspeicher_array[0].length - 1, zwischenspeicher_array[0].length); // eine Stelle vorm Komma
        logging && adapter.log.debug(zwischenspeicher_array_vorn);
        const zwischenspeicher_array_hinten = zwischenspeicher_array[1].slice(0, 2);   // zwei Stellen nach dem Komma
        logging && adapter.log.debug(zwischenspeicher_array_hinten);
        return parseFloat(`${zwischenspeicher_array_vorn}.${zwischenspeicher_array_hinten}`);
    }
    zwischenspeicher = 'Fehler beim Ausschneiden';
    adapter.log.error(zwischenspeicher);
    adapter.stop();
    return 0;
}

function loeseDatum(body, text1) {
    const start = body.indexOf(text1) - 5;
    const ende = body.indexOf(text1) + 5;                                         // xx.xx.xxxx
    logging && adapter.log.debug(`Startposition: ${start}`);
    logging && adapter.log.debug(`Endposition: ${ende}`);
    let zwischenspeicher;
    if (start !== -1 && ende !== -1) {                                        // Fehler abfangen
        zwischenspeicher = body.slice(start, ende);
        const datum_array = zwischenspeicher.split('.');
        const xDatum = new Date();
        logging && adapter.log.debug(`Tag: ${datum_array[0]}`);
        logging && adapter.log.debug(`Monat: ${datum_array[1]}`);
        logging && adapter.log.debug(`Jahr: ${datum_array[2]}`);
        xDatum.setDate(datum_array[0]);
        xDatum.setMonth(datum_array[1] - 1);
        xDatum.setFullYear(datum_array[2]);
        logging && adapter.log.debug(xDatum);
        //return(formatDate(xDatum, "TT.MM.JJJJ"));
        const xDatum_workaround = `${xDatum.getDate() < 10 ? `0${xDatum.getDate()}` : xDatum.getDate()}.${xDatum.getMonth() + 1 < 10 ? `0${xDatum.getMonth() + 1}` : xDatum.getMonth() + 1}.${xDatum.getFullYear()}`;
        return xDatum_workaround;
    }
    zwischenspeicher = 'Fehler beim Ausschneiden';
    adapter.log.error(zwischenspeicher);
    adapter.stop();
    return null;
}

function findeWertClearsky (body) {
    const text1 = "<td height=17 class=xl1525883 style='height:12.75pt'>clear sky:</td>"; // erstes Auftauchen
    const text2 = "<td class=xl6525883>kWh/kWp</td>";                 // erstes Auftauchen
    const clearsky = erstes_erstesAuftauchen(body,text1,text2);
    logging && adapter.log.debug(`ClearSky: ${clearsky}`);
    adapter.setState(idClearSky, {ack: true, val: clearsky});                         // Wert in Objekt schreiben
    adapter.setState(idHomeClearSky, {ack: true, val: clearsky * power});             // Wert in Objekt schreiben
}

function findeWertRealskyMinimum (body) {
    const text1 = 'real sky:</td>';                                   // erstes Auftauchen
    const text2 = '<td class=xl6825883>-</td>';                       // erstes Auftauchen
    const realsky_min = erstes_erstesAuftauchen(body,text1,text2);
    logging && adapter.log.debug(`RealSkyMinimum: ${realsky_min}`);
    adapter.setState(idRealSkyMin, {ack: true, val: realsky_min});                    // Wert in Objekt schreiben
    adapter.setState(idHomeRealSkyMin, {ack: true, val: realsky_min * power});        // Wert in Objekt schreiben
}

function findeWertRealskyMaximum (body) {
    const text1 = '<td class=xl6825883>-</td>';                       // erstes Auftauchen
    const text2 = '<td class=xl6525883>kWh/kWp</td>';                 // letztes Auftauchen
    const realsky_max = erstes_letztesAuftauchen(body,text1,text2);
    logging && adapter.log.debug(`RealSkyMaximum: ${realsky_max}`);
    adapter.setState(idRealSkyMax, {ack: true, val: realsky_max});                    // Wert in Objekt schreiben
    adapter.setState(idHomeRealSkyMax, {ack: true, val: realsky_max * power});        // Wert in Objekt schreiben
}

function findeDatum(body) {
    const jetzt = new Date();
    const Jahr = jetzt.getFullYear();                                 // aktuelles Jahr ermitteln
    const text1 = `.${Jahr}</td>`;                                 // erstes Auftauchen vom aktuellen Jahr finden
    const datum = loeseDatum(body, text1);
    logging && adapter.log.debug(`Datum: ${datum}`);
    adapter.setState(idDatum, {ack: true, val: datum});                                       // Wert in Objekt schreiben
}

function leseWebseite () {
    const link = `http://www.vorhersage-plz-bereich.solar-wetter.com/html/${plz}.htm`;
    logging && adapter.log.debug(`link to be retrieved: ${link}`);
    if (!plz || plz.length < 3) {
        adapter.log.warn('Kein PLZ-Bereich festgelegt. Adapter wird angehalten');
        adapter.stop;
    }
    try {
        axios(link)
            .then(response => {
                const body = response.data;
                findeWertClearsky(body);
                findeWertRealskyMinimum(body);
                findeWertRealskyMaximum(body);
                findeDatum(body);
            })
            .catch(error => adapter.log.error(error));
    } catch (e) {
        adapter.log.error(`Fehler (try) leseWebseite: ${e}`);
    }
}

function main() {
    readSettings();
    adapter.log.info('objects written');
}
