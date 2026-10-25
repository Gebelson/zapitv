import { LiveChannel, EpgProgram, CurrentEpgState } from './types';
import { epgAggregator, EPGAggregator, EpgDateOption } from './EPGAggregator';

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

  public getDailySchedule(channel: LiveChannel, dateOffset = 0): EpgProgram[] {
    return epgAggregator.getDailySchedule(channel, dateOffset);
  }

  public getCurrentEpgState(channel: LiveChannel): CurrentEpgState {
    return epgAggregator.getCurrentEpgState(channel);
  }

  public getAvailableDates(channel: LiveChannel): EpgDateOption[] {
    return epgAggregator.getAvailableDates(channel);
  }

  public hasRealEpg(channelId: string): boolean {
    return epgAggregator.hasRealEpg(channelId);
  }

  public async fetchServerEpg(channelId?: string): Promise<void> {
    return epgAggregator.fetchServerEpg(channelId);
  }
}

export const epgService = EpgService.getInstance();
export { epgAggregator, EPGAggregator };
export type { EpgDateOption };
