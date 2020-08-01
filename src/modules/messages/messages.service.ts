import { Injectable, Inject, forwardRef } from '@nestjs/common';
import {
  Message,
  LineMessage,
  DiscordMessage,
  FileWithUrl,
} from './messages.model';
import { LineService } from '../line/line.service';
import { CommandsService } from '../commands/commands.service';
import { DiscordService } from '../discord/discord.service';
import { AppLogger } from '../logger/logger';
import { Client } from '@line/bot-sdk';

@Injectable()
export class MessagesService {
  constructor(
    private commandService: CommandsService,
    @Inject(forwardRef(() => LineService))
    private lineService: LineService,
    @Inject(forwardRef(() => DiscordService))
    private discordService: DiscordService,
    private logger: AppLogger,
  ) {
    this.logger.setContext('MessageService');
  }

  async handleMessage(message: Message) {
    this.logger.debug(`Message From ${message.channel}`);
    let reply: Message;
    if (this.commandService.isCommand(message)) {
      reply = await this.commandService.handleCommand(message);
    } else {
      return;
    }
    switch (message.channel) {
      case 'line':
        this.sendMessage({
          channel: 'line',
          ...reply,
          replyToken: (message as LineMessage).replyToken,
        } as LineMessage);
        break;
      case 'discord':
        this.sendMessage({
          ...reply,
          channel: 'discord',
          messageChannel: (message as DiscordMessage).messageChannel,
        } as DiscordMessage);
        break;
    }
  }

  sendMessage(message: Message) {
    switch (message.channel) {
      case 'line':
        let lineMsg: Parameters<Client['replyMessage']>[1] = {
          type: 'text',
          text: message.message,
        };
        if (message.image) {
          lineMsg = {
            type: 'image',
            originalContentUrl: message.image.url,
            previewImageUrl: message.image.url,
          };
        }
        const files = message.files as FileWithUrl[];
        if (files?.length > 0) {
          lineMsg = {
            type: 'text',
            text: message.message + '\n' + `${files[0].name} - ${files[0].url}`,
          };
        }
        if ((message as LineMessage).pushTo) {
          return this.lineService
            .sendPushMessage(lineMsg, (message as LineMessage).pushTo)
            .catch(e => {
              this.logger.error(e.data);
            });
        }
        return this.lineService
          .sendReplyMessage(lineMsg, (message as LineMessage).replyToken)
          .catch(e => {
            this.logger.error(e.data);
          });
      case 'discord':
        const m = message as DiscordMessage;
        return this.discordService.sendMessage(m.messageChannel, {
          content: m.message,
          files: [
            m.image && {
              attachment: m.image.url,
              name: m.image.name,
            },
            ...(m.files?.map(m => ({
              attachment: (m as FileWithUrl).url,
              name: m.name,
            })) ?? []),
          ].filter(e => e),
        });
    }
  }
}
