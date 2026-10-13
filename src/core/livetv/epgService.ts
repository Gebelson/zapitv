import { LiveChannel, EpgProgram, CurrentEpgState } from './types';
import { epgAggregator, EPGAggregator } from './EPGAggregator';

export class EpgService {
  private static instance: EpgService;

  public static getInstance(): EpgService {
    if (!EpgService.instance) {
      EpgService.instance = new EpgService();
    }
    return EpgService.instance;
  }

  public getCurrentBrazilMinutes(): number {
    return epgAggregator.getCurrentBrazilMinutes();
  }

  public getDailySchedule(channel: LiveChannel): EpgProgram[] {
    return epgAggregator.getDailySchedule(channel);
  }

  public getCurrentEpgState(channel: LiveChannel): CurrentEpgState {
    return epgAggregator.getCurrentEpgState(channel);
  }
}

export const epgService = EpgService.getInstance();
export { epgAggregator, EPGAggregator };
