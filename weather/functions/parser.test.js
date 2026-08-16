const assert = require("assert");
process.env.FIREBASE_CONFIG = "{}";
const { parseHeavy, parseRainfallAdvisory } = require("./index.js")._test;

const heavySample = `Heavy Rainfall Warning No. 44 #NCR_PRSD
Weather System: Enhanced Southwest Monsoon (Habagat)
Issued at: 5:00 PM, 10 August 2026(Monday)
RED WARNING LEVEL: Bulacan(Dona Remedios Trinidad, Norzagaray, San Jose del Monte), Metro Manila(Caloocan).
ASSOCIATED HAZARD: Serious FLOODING is expected.
ORANGE WARNING LEVEL: Bulacan(Angat, Balagtas, Baliuag, Bocaue, Bulakan, Bustos, Calumpit, Malolos, Meycauayan, Guiguinto, Hagonoy, Marilao, Obando, Pandi, Paombong, Plaridel, Pulilan, San Ildefonso, San Miguel, San Rafael, Santa Maria).
ASSOCIATED HAZARD: FLOODING is THREATENING.
YELLOW WARNING LEVEL: Nueva Ecija(Gapan).
ASSOCIATED HAZARD: FLOODING in flood-prone areas.
Meanwhile, expect light to moderate rains over Bulacan(Pulilan) within the next 3 hours.
Light to moderate with occasional heavy rains affecting Bulacan(Hagonoy, Calumpit) which may persist within 3 hours and may affect nearby areas.
As of today, there is no Thunderstorm Advisory Issued.`;

const h = parseHeavy(heavySample);
assert(h);
assert.equal(h.warningNo, "44");
assert(h.levels.RED.includes("Doña Remedios Trinidad"));
assert(h.levels.ORANGE.includes("Baliwag"));
assert(h.rainfallContext.expecting.includes("Pulilan"));
assert(h.rainfallContext.affecting.includes("Hagonoy"));

const advisorySample = `Rainfall Advisory No. 15 #NCR_PRSD
Weather System: Southwest Monsoon (Habagat)
Issued at: 5:00 PM, 11 August 2026(Tuesday)
Light to moderate with occasional heavy rains are expected over Cavite, Tarlac(Mayantoc, San Clemente) and Nueva Ecija(San Antonio, Cabiao).
Light to moderate rains affecting Rizal, Metro Manila(Quezon City), Bulacan(San Ildefonso, Dona Remedios Trinidad, San Rafael, Norzagaray, Angat, San Jose del Monte, Santa Maria), Quezon(General Nakar) and may affect nearby areas.
The public and the Disaster Risk Reduction and Management Offices concerned are advised to MONITOR the weather condition.
Rainfall Advisory No. 14 #NCR_PRSD
Weather System: Southwest Monsoon (Habagat)
Issued at: 2:00 PM, 11 August 2026(Tuesday)
Light to moderate with occasional heavy rains affecting Bulacan, Rizal, Bataan and may affect nearby areas.`;

const a = parseRainfallAdvisory(advisorySample);
assert(a);
assert.equal(a.advisoryNo, "15");
assert.equal(a.type, "rainfall_advisory");
assert.equal(a.rainfallContext.expecting.length, 0);
assert.deepEqual(a.rainfallContext.affecting.sort(), ["Angat", "Doña Remedios Trinidad", "Norzagaray", "San Ildefonso", "San Jose del Monte", "San Rafael", "Santa Maria"].sort());

const wholeProvinceSample = `Rainfall Advisory No. 14 #NCR_PRSD
Weather System: Southwest Monsoon (Habagat)
Issued at: 2:00 PM, 11 August 2026(Tuesday)
Light to moderate with occasional heavy rains are expected over Zambales.
Light to moderate with occasional heavy rains affecting Bulacan, Rizal, Bataan, Laguna(Santa Maria) and may affect nearby areas.
The public is advised to monitor.`;
const whole = parseRainfallAdvisory(wholeProvinceSample);
assert(whole);
assert.equal(whole.rainfallContext.affecting.length, 24);
assert(whole.rainfallContext.affecting.includes("Santa Maria"));
assert(whole.rainfallContext.affecting.includes("San Miguel"));

console.log("parser tests passed");
