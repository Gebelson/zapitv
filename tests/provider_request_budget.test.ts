import {it,expect,vi,afterAll} from 'vitest';
import {providerRegistry} from '../src/core/providers/providerRegistry';
import {StremioClient} from '../src/core/stremio/stremioClient';
import {tmdbService} from '../src/core/tmdb/tmdbClient';
import {subtitleService} from '../src/core/subtitles/subtitleService';
import {canonicalCatalogMaster} from '../src/core/catalog/CanonicalCatalogMaster';
afterAll(()=>canonicalCatalogMaster.dispose());
it('does not grant alternate identifiers fresh budgets after provider deadline',async()=>{
 let now=Date.now();
 vi.spyOn(Date,'now').mockImplementation(()=>now);
 vi.spyOn(providerRegistry,'getEligibleProviders').mockReturnValue([{id:'budget-fixture',name:'Fixture',url:'https://example.test',type:'stremio-addon',enabled:true,status:'online',priority:1}]);
 vi.spyOn(tmdbService,'getAlternativeTitles').mockResolvedValue([]);
 vi.spyOn(subtitleService,'hasPtBrSubtitles').mockResolvedValue(false);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({sources:[]})));
 const streams=vi.spyOn(StremioClient.prototype,'getStreams').mockImplementation(async()=>{now+=5000;return {streams:[]};});
 const outcomes:string[]=[];
 try{await providerRegistry.resolveStreamsFresh('movie',{id:'budget-fixture',tmdbId:'99999999',imdbId:'tt9999999',title:'Budget Fixture'},undefined,undefined,undefined,{onProviderResult:d=>outcomes.push(d.outcome!)});expect(streams).toHaveBeenCalledTimes(1);expect(outcomes).toEqual(['TIMEOUT']);}
 finally{vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('successful alternate identity replaces the primary technical failure',async()=>{
 vi.spyOn(providerRegistry,'getEligibleProviders').mockReturnValue([{id:'alternate-fixture',name:'Fixture',url:'https://example.test',type:'stremio-addon',enabled:true,status:'online',priority:1}]);
 vi.spyOn(tmdbService,'getAlternativeTitles').mockResolvedValue([]);
 vi.spyOn(subtitleService,'hasPtBrSubtitles').mockResolvedValue(false);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({sources:[]})));
 vi.spyOn(StremioClient.prototype,'getStreams').mockRejectedValueOnce(Object.assign(new Error('HTTP 500'),{status:500})).mockResolvedValue({streams:[{title:'Alternate Fixture (2020) 1080p',url:'https://media.example.test/fixture.mp4'}]});
 const outcomes:string[]=[];
 try{
  const streams=await providerRegistry.resolveStreamsFresh('movie',{id:'alternate-fixture',tmdbId:'99999998',imdbId:'tt9999998',title:'Alternate Fixture',year:2020},undefined,undefined,undefined,{onProviderResult:d=>outcomes.push(d.outcome!)});
  expect(streams).toHaveLength(1);expect(outcomes).toEqual(['SUCCESS_WITH_STREAMS']);
 }finally{vi.restoreAllMocks();vi.unstubAllGlobals();}
});
