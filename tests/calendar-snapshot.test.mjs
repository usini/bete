import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanCalendarSnapshot} from '../js/calendar-snapshot.js';
test('calendar snapshot keeps only the first two events and no feed secrets',()=>{
 const make=(day)=>({title:'RDV '+day,start:`2026-11-${day}T10:00:00Z`,end:`2026-11-${day}T11:00:00Z`,feed:'secret',allDay:false});
 const result=cleanCalendarSnapshot([make(12),make(10),make(11)]);
 assert.deepEqual(result.map(e=>e.title),['RDV 10','RDV 11']);assert.equal(result[0].feed,undefined);
});
test('calendar snapshot rejects malformed event dates and safely handles old backups',()=>{
 assert.deepEqual(cleanCalendarSnapshot(undefined),[]);
 assert.deepEqual(cleanCalendarSnapshot([{title:'bad',start:'bad',end:'bad'},{title:'reverse',start:'2026-11-11',end:'2026-11-10'}]),[]);
});
