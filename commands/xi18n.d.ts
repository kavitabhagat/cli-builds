/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ArchitectCommand, ArchitectCommandOptions } from '../models/architect-command';
import { CommandScope, Option } from '../models/command';
export default class Xi18nCommand extends ArchitectCommand {
    readonly name: string;
    readonly target: string;
    readonly description: string;
    readonly scope: CommandScope;
    readonly multiTarget: true;
    readonly options: Option[];
    run(options: ArchitectCommandOptions): Promise<number>;
}
