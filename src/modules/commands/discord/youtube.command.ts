import { Injectable } from '@nestjs/common';
import { Message, DiscordMessage } from '../../messages/messages.model';
import { BaseCommand } from '../command.base';
import { DiscordService } from 'src/modules/discord/discord.service';
import * as ytdl from 'ytdl-core';
import * as ytsr from 'ytsr';
import { AudioService } from 'src/modules/audio/audio.service';

@Injectable()
export class YoutubeCommand extends BaseCommand {
  public command = /^(?:youtube|yt)(?: (volume|play|stop)(?: (.*)?)?)?/i;
  public requiresAuth = false;
  public platforms = ['discord'];

  constructor(private discord: DiscordService, private audio: AudioService) {
    super();
  }
  async handle(
    message: DiscordMessage,
    command: string,
    url: string,
    volume?: string,
  ): Promise<Message> {
    switch (command) {
      case 'play':
        if (!url) {
          return {
            ...message,
            files: [],
            message: `Please supply a url`,
          };
        }
        const vidUrl = /^http(s)?:\/\/(.*)/.test(url)
          ? url
          : ((await ytsr(url)).items.find(
              e => e.type === 'video',
            ) as ytsr.Video).link;
        const meta = await ytdl.getInfo(vidUrl);
        if (!meta) {
          return {
            ...message,
            files: [],
            message: `Video not found`,
          };
        }
        try {
          await this.audio.playAudio(
            message,
            ytdl(vidUrl),
            isNaN(Number(volume)) || Number(volume) > 1
              ? undefined
              : Number(volume),
          );
          return {
            ...message,
            files: [],
            message: `Playing \`${meta.videoDetails.title}\``,
          };
        } catch (e) {
          console.log(e);
          if (e.message === 'PLAYING') {
            return {
              ...message,
              files: [],
              message: `Something is playing, we don't have queue. So either stop or wait lul`,
            };
          }
          return {
            ...message,
            files: [],
            message: `Something went wrong`,
          };
        }
      case 'stop':
        await this.audio.stopPlaying(message);
        return {
          ...message,
          files: [],
          message: `Stopped music`,
        };
      case 'volume':
        const vol = Number(url);
        if (isNaN(vol) || vol <= 0 || vol >= 1) {
          return {
            ...message,
            files: [],
            message: 'Invalid volume value ( only  0 - 1 )',
          };
        }
        await this.audio.changeVolume(message, vol);
        return {
          ...message,
          files: [],
          message: `Changed volume to ${Math.round(vol * 100)}%`,
        };
      default:
        return {
          ...message,
          files: [],
          message: 'Usage: stream <list|play|stop> index',
        };
    }
  }
}