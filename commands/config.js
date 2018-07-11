"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const command_1 = require("../models/command");
const config_1 = require("../utilities/config");
const validCliPaths = new Map([
    ['cli.warnings.versionMismatch', 'boolean'],
    ['cli.warnings.typescriptMismatch', 'boolean'],
    ['cli.defaultCollection', 'string'],
    ['cli.packageManager', 'string'],
]);
/**
 * Splits a JSON path string into fragments. Fragments can be used to get the value referenced
 * by the path. For example, a path of "a[3].foo.bar[2]" would give you a fragment array of
 * ["a", 3, "foo", "bar", 2].
 * @param path The JSON string to parse.
 * @returns {string[]} The fragments for the string.
 * @private
 */
function parseJsonPath(path) {
    const fragments = (path || '').split(/\./g);
    const result = [];
    while (fragments.length > 0) {
        const fragment = fragments.shift();
        if (fragment == undefined) {
            break;
        }
        const match = fragment.match(/([^\[]+)((\[.*\])*)/);
        if (!match) {
            throw new Error('Invalid JSON path.');
        }
        result.push(match[1]);
        if (match[2]) {
            const indices = match[2].slice(1, -1).split('][');
            result.push(...indices);
        }
    }
    return result.filter(fragment => !!fragment);
}
function getValueFromPath(root, path) {
    const fragments = parseJsonPath(path);
    try {
        return fragments.reduce((value, current) => {
            if (value == undefined || typeof value != 'object') {
                return undefined;
            }
            else if (typeof current == 'string' && !Array.isArray(value)) {
                return value[current];
            }
            else if (typeof current == 'number' && Array.isArray(value)) {
                return value[current];
            }
            else {
                return undefined;
            }
        }, root);
    }
    catch (_a) {
        return undefined;
    }
}
function setValueFromPath(root, path, newValue) {
    const fragments = parseJsonPath(path);
    try {
        return fragments.reduce((value, current, index) => {
            if (value == undefined || typeof value != 'object') {
                return undefined;
            }
            else if (typeof current == 'string' && !Array.isArray(value)) {
                if (index === fragments.length - 1) {
                    value[current] = newValue;
                }
                else if (value[current] == undefined) {
                    if (typeof fragments[index + 1] == 'number') {
                        value[current] = [];
                    }
                    else if (typeof fragments[index + 1] == 'string') {
                        value[current] = {};
                    }
                }
                return value[current];
            }
            else if (typeof current == 'number' && Array.isArray(value)) {
                if (index === fragments.length - 1) {
                    value[current] = newValue;
                }
                else if (value[current] == undefined) {
                    if (typeof fragments[index + 1] == 'number') {
                        value[current] = [];
                    }
                    else if (typeof fragments[index + 1] == 'string') {
                        value[current] = {};
                    }
                }
                return value[current];
            }
            else {
                return undefined;
            }
        }, root);
    }
    catch (_a) {
        return undefined;
    }
}
function normalizeValue(value, path) {
    const cliOptionType = validCliPaths.get(path);
    if (cliOptionType) {
        switch (cliOptionType) {
            case 'boolean':
                if (value.trim() === 'true') {
                    return true;
                }
                else if (value.trim() === 'false') {
                    return false;
                }
                break;
            case 'number':
                const numberValue = Number(value);
                if (!Number.isNaN(numberValue)) {
                    return numberValue;
                }
                break;
            case 'string':
                return value;
        }
        throw new Error(`Invalid value type; expected a ${cliOptionType}.`);
    }
    if (typeof value === 'string') {
        try {
            return core_1.parseJson(value, core_1.JsonParseMode.Loose);
        }
        catch (e) {
            if (e instanceof core_1.InvalidJsonCharacterException && !value.startsWith('{')) {
                return value;
            }
            else {
                throw e;
            }
        }
    }
    return value;
}
class ConfigCommand extends command_1.Command {
    constructor() {
        super(...arguments);
        this.name = 'config';
        this.description = 'Get/set configuration values.';
        this.arguments = ['jsonPath', 'value'];
        this.options = [
            {
                name: 'global',
                type: Boolean,
                'default': false,
                aliases: ['g'],
                description: 'Get/set the value in the global configuration (in your home directory).',
            },
        ];
    }
    run(options) {
        const level = options.global ? 'global' : 'local';
        let config = config_1.getWorkspace(level);
        if (options.global && !config) {
            try {
                if (config_1.migrateLegacyGlobalConfig()) {
                    config =
                        config_1.getWorkspace(level);
                    this.logger.info(core_1.tags.oneLine `
            We found a global configuration that was used in Angular CLI 1.
            It has been automatically migrated.`);
                }
            }
            catch (_a) { }
        }
        if (options.value == undefined) {
            if (!config) {
                this.logger.error('No config found.');
                return 1;
            }
            return this.get(config._workspace, options);
        }
        else {
            return this.set(options);
        }
    }
    get(config, options) {
        let value;
        if (options.jsonPath) {
            value = getValueFromPath(config, options.jsonPath);
        }
        else {
            value = config;
        }
        if (value === undefined) {
            this.logger.error('Value cannot be found.');
            return 1;
        }
        else if (typeof value == 'object') {
            this.logger.info(JSON.stringify(value, null, 2));
        }
        else {
            this.logger.info(value.toString());
        }
    }
    set(options) {
        if (!options.jsonPath || !options.jsonPath.trim()) {
            throw new Error('Invalid Path.');
        }
        if (options.global
            && !options.jsonPath.startsWith('schematics.')
            && !validCliPaths.has(options.jsonPath)) {
            throw new Error('Invalid Path.');
        }
        const [config, configPath] = config_1.getWorkspaceRaw(options.global ? 'global' : 'local');
        if (!config || !configPath) {
            this.logger.error('Confguration file cannot be found.');
            return 1;
        }
        // TODO: Modify & save without destroying comments
        const configValue = config.value;
        const value = normalizeValue(options.value || '', options.jsonPath);
        const result = setValueFromPath(configValue, options.jsonPath, value);
        if (result === undefined) {
            this.logger.error('Value cannot be found.');
            return 1;
        }
        try {
            config_1.validateWorkspace(configValue);
        }
        catch (error) {
            this.logger.fatal(error.message);
            return 1;
        }
        const output = JSON.stringify(configValue, null, 2);
        fs_1.writeFileSync(configPath, output);
    }
}
exports.ConfigCommand = ConfigCommand;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyL2NsaS9jb21tYW5kcy9jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQ0FTOEI7QUFDOUIsMkJBQW1DO0FBQ25DLCtDQUFvRDtBQUNwRCxnREFLNkI7QUFTN0IsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDNUIsQ0FBQyw4QkFBOEIsRUFBRSxTQUFTLENBQUM7SUFDM0MsQ0FBQyxpQ0FBaUMsRUFBRSxTQUFTLENBQUM7SUFDOUMsQ0FBQyx1QkFBdUIsRUFBRSxRQUFRLENBQUM7SUFDbkMsQ0FBQyxvQkFBb0IsRUFBRSxRQUFRLENBQUM7Q0FDakMsQ0FBQyxDQUFDO0FBRUg7Ozs7Ozs7R0FPRztBQUNILHVCQUF1QixJQUFZO0lBQ2pDLE1BQU0sU0FBUyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1QyxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFFNUIsT0FBTyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzVCLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyxFQUFFLENBQUMsQ0FBQyxRQUFRLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQztZQUMxQixLQUFLLENBQUM7UUFDUixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3BELEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2IsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO1FBQzFCLENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUVELDBCQUNFLElBQU8sRUFDUCxJQUFZO0lBRVosTUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXRDLElBQUksQ0FBQztRQUNILE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBZ0IsRUFBRSxPQUF3QixFQUFFLEVBQUU7WUFDckUsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQ25CLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxPQUFPLElBQUksUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9ELE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDeEIsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLE9BQU8sSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzlELE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDeEIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQyxTQUFTLENBQUM7WUFDbkIsQ0FBQztRQUNILENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNYLENBQUM7SUFBQyxLQUFLLENBQUMsQ0FBQyxJQUFELENBQUM7UUFDUCxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ25CLENBQUM7QUFDSCxDQUFDO0FBRUQsMEJBQ0UsSUFBTyxFQUNQLElBQVksRUFDWixRQUFtQjtJQUVuQixNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdEMsSUFBSSxDQUFDO1FBQ0gsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFnQixFQUFFLE9BQXdCLEVBQUUsS0FBYSxFQUFFLEVBQUU7WUFDcEYsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNuRCxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQ25CLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxPQUFPLElBQUksUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9ELEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUM7Z0JBQzVCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUN2QyxFQUFFLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDNUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztvQkFDdEIsQ0FBQztvQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQ25ELEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ3RCLENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3hCLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxPQUFPLElBQUksUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5RCxFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dCQUM1QixDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQztvQkFDdkMsRUFBRSxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0JBQzVDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ3RCLENBQUM7b0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDO3dCQUNuRCxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUN0QixDQUFDO2dCQUNILENBQUM7Z0JBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN4QixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUNuQixDQUFDO1FBQ0gsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQUFDLEtBQUssQ0FBQyxDQUFDLElBQUQsQ0FBQztRQUNQLE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFDbkIsQ0FBQztBQUNILENBQUM7QUFFRCx3QkFBd0IsS0FBYSxFQUFFLElBQVk7SUFDakQsTUFBTSxhQUFhLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7WUFDdEIsS0FBSyxTQUFTO2dCQUNaLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNkLENBQUM7Z0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNwQyxNQUFNLENBQUMsS0FBSyxDQUFDO2dCQUNmLENBQUM7Z0JBQ0QsS0FBSyxDQUFDO1lBQ1IsS0FBSyxRQUFRO2dCQUNYLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDbEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsTUFBTSxDQUFDLFdBQVcsQ0FBQztnQkFDckIsQ0FBQztnQkFDRCxLQUFLLENBQUM7WUFDUixLQUFLLFFBQVE7Z0JBQ1gsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM5QixJQUFJLENBQUM7WUFDSCxNQUFNLENBQUMsZ0JBQVMsQ0FBQyxLQUFLLEVBQUUsb0JBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNYLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxvQ0FBNkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN6RSxNQUFNLENBQUMsS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQyxDQUFDO1lBQ1YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxtQkFBMkIsU0FBUSxpQkFBTztJQUExQzs7UUFDa0IsU0FBSSxHQUFHLFFBQVEsQ0FBQztRQUNoQixnQkFBVyxHQUFHLCtCQUErQixDQUFDO1FBQzlDLGNBQVMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsQyxZQUFPLEdBQWE7WUFDbEM7Z0JBQ0UsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLE9BQU87Z0JBQ2IsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQztnQkFDZCxXQUFXLEVBQUUseUVBQXlFO2FBQ3ZGO1NBQ0YsQ0FBQztJQTZGSixDQUFDO0lBM0ZRLEdBQUcsQ0FBQyxPQUFzQjtRQUMvQixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUVsRCxJQUFJLE1BQU0sR0FDUCxxQkFBWSxDQUFDLEtBQUssQ0FBa0UsQ0FBQztRQUV4RixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUM7Z0JBQ0gsRUFBRSxDQUFDLENBQUMsa0NBQXlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ2hDLE1BQU07d0JBQ0gscUJBQVksQ0FBQyxLQUFLLENBQWtFLENBQUM7b0JBQ3hGLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQUksQ0FBQyxPQUFPLENBQUE7O2dEQUVTLENBQUMsQ0FBQztnQkFDMUMsQ0FBQztZQUNILENBQUM7WUFBQyxLQUFLLENBQUMsQ0FBQyxJQUFELENBQUMsQ0FBQSxDQUFDO1FBQ1osQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQztZQUMvQixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztnQkFFdEMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNYLENBQUM7WUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLENBQUM7SUFDSCxDQUFDO0lBRU8sR0FBRyxDQUFDLE1BQThDLEVBQUUsT0FBc0I7UUFDaEYsSUFBSSxLQUFLLENBQUM7UUFDVixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNyQixLQUFLLEdBQUcsZ0JBQWdCLENBQUMsTUFBMEIsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sS0FBSyxHQUFHLE1BQU0sQ0FBQztRQUNqQixDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUU1QyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEtBQUssSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7SUFDSCxDQUFDO0lBRU8sR0FBRyxDQUFDLE9BQXNCO1FBQ2hDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2xELE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNO2VBQ1gsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7ZUFDM0MsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBRUQsTUFBTSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsR0FBRyx3QkFBZSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEYsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7WUFFeEQsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNYLENBQUM7UUFFRCxrREFBa0Q7UUFDbEQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUVqQyxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXRFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSCwwQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNmLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVqQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNwRCxrQkFBYSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNwQyxDQUFDO0NBRUY7QUF6R0Qsc0NBeUdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbixcbiAgSnNvbkFycmF5LFxuICBKc29uT2JqZWN0LFxuICBKc29uUGFyc2VNb2RlLFxuICBKc29uVmFsdWUsXG4gIGV4cGVyaW1lbnRhbCxcbiAgcGFyc2VKc29uLFxuICB0YWdzLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyB3cml0ZUZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnLi4vbW9kZWxzL2NvbW1hbmQnO1xuaW1wb3J0IHtcbiAgZ2V0V29ya3NwYWNlLFxuICBnZXRXb3Jrc3BhY2VSYXcsXG4gIG1pZ3JhdGVMZWdhY3lHbG9iYWxDb25maWcsXG4gIHZhbGlkYXRlV29ya3NwYWNlLFxufSBmcm9tICcuLi91dGlsaXRpZXMvY29uZmlnJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpZ09wdGlvbnMge1xuICBqc29uUGF0aDogc3RyaW5nO1xuICB2YWx1ZT86IHN0cmluZztcbiAgZ2xvYmFsPzogYm9vbGVhbjtcbn1cblxuY29uc3QgdmFsaWRDbGlQYXRocyA9IG5ldyBNYXAoW1xuICBbJ2NsaS53YXJuaW5ncy52ZXJzaW9uTWlzbWF0Y2gnLCAnYm9vbGVhbiddLFxuICBbJ2NsaS53YXJuaW5ncy50eXBlc2NyaXB0TWlzbWF0Y2gnLCAnYm9vbGVhbiddLFxuICBbJ2NsaS5kZWZhdWx0Q29sbGVjdGlvbicsICdzdHJpbmcnXSxcbiAgWydjbGkucGFja2FnZU1hbmFnZXInLCAnc3RyaW5nJ10sXG5dKTtcblxuLyoqXG4gKiBTcGxpdHMgYSBKU09OIHBhdGggc3RyaW5nIGludG8gZnJhZ21lbnRzLiBGcmFnbWVudHMgY2FuIGJlIHVzZWQgdG8gZ2V0IHRoZSB2YWx1ZSByZWZlcmVuY2VkXG4gKiBieSB0aGUgcGF0aC4gRm9yIGV4YW1wbGUsIGEgcGF0aCBvZiBcImFbM10uZm9vLmJhclsyXVwiIHdvdWxkIGdpdmUgeW91IGEgZnJhZ21lbnQgYXJyYXkgb2ZcbiAqIFtcImFcIiwgMywgXCJmb29cIiwgXCJiYXJcIiwgMl0uXG4gKiBAcGFyYW0gcGF0aCBUaGUgSlNPTiBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcmV0dXJucyB7c3RyaW5nW119IFRoZSBmcmFnbWVudHMgZm9yIHRoZSBzdHJpbmcuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBwYXJzZUpzb25QYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgZnJhZ21lbnRzID0gKHBhdGggfHwgJycpLnNwbGl0KC9cXC4vZyk7XG4gIGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblxuICB3aGlsZSAoZnJhZ21lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBmcmFnbWVudCA9IGZyYWdtZW50cy5zaGlmdCgpO1xuICAgIGlmIChmcmFnbWVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoID0gZnJhZ21lbnQubWF0Y2goLyhbXlxcW10rKSgoXFxbLipcXF0pKikvKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSlNPTiBwYXRoLicpO1xuICAgIH1cblxuICAgIHJlc3VsdC5wdXNoKG1hdGNoWzFdKTtcbiAgICBpZiAobWF0Y2hbMl0pIHtcbiAgICAgIGNvbnN0IGluZGljZXMgPSBtYXRjaFsyXS5zbGljZSgxLCAtMSkuc3BsaXQoJ11bJyk7XG4gICAgICByZXN1bHQucHVzaCguLi5pbmRpY2VzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0LmZpbHRlcihmcmFnbWVudCA9PiAhIWZyYWdtZW50KTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVGcm9tUGF0aDxUIGV4dGVuZHMgSnNvbkFycmF5IHwgSnNvbk9iamVjdD4oXG4gIHJvb3Q6IFQsXG4gIHBhdGg6IHN0cmluZyxcbik6IEpzb25WYWx1ZSB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGZyYWdtZW50cyA9IHBhcnNlSnNvblBhdGgocGF0aCk7XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gZnJhZ21lbnRzLnJlZHVjZSgodmFsdWU6IEpzb25WYWx1ZSwgY3VycmVudDogc3RyaW5nIHwgbnVtYmVyKSA9PiB7XG4gICAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB2YWx1ZSAhPSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY3VycmVudCA9PSAnc3RyaW5nJyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlW2N1cnJlbnRdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY3VycmVudCA9PSAnbnVtYmVyJyAmJiBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gdmFsdWVbY3VycmVudF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sIHJvb3QpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldFZhbHVlRnJvbVBhdGg8VCBleHRlbmRzIEpzb25BcnJheSB8IEpzb25PYmplY3Q+KFxuICByb290OiBULFxuICBwYXRoOiBzdHJpbmcsXG4gIG5ld1ZhbHVlOiBKc29uVmFsdWUsXG4pOiBKc29uVmFsdWUgfCB1bmRlZmluZWQge1xuICBjb25zdCBmcmFnbWVudHMgPSBwYXJzZUpzb25QYXRoKHBhdGgpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGZyYWdtZW50cy5yZWR1Y2UoKHZhbHVlOiBKc29uVmFsdWUsIGN1cnJlbnQ6IHN0cmluZyB8IG51bWJlciwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCB8fCB0eXBlb2YgdmFsdWUgIT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGN1cnJlbnQgPT0gJ3N0cmluZycgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIGlmIChpbmRleCA9PT0gZnJhZ21lbnRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICB2YWx1ZVtjdXJyZW50XSA9IG5ld1ZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlW2N1cnJlbnRdID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgZnJhZ21lbnRzW2luZGV4ICsgMV0gPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHZhbHVlW2N1cnJlbnRdID0gW107XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZnJhZ21lbnRzW2luZGV4ICsgMV0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhbHVlW2N1cnJlbnRdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlW2N1cnJlbnRdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY3VycmVudCA9PSAnbnVtYmVyJyAmJiBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBpZiAoaW5kZXggPT09IGZyYWdtZW50cy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgdmFsdWVbY3VycmVudF0gPSBuZXdWYWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVtjdXJyZW50XSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGZyYWdtZW50c1tpbmRleCArIDFdID09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB2YWx1ZVtjdXJyZW50XSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGZyYWdtZW50c1tpbmRleCArIDFdID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB2YWx1ZVtjdXJyZW50XSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWx1ZVtjdXJyZW50XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSwgcm9vdCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsdWU6IHN0cmluZywgcGF0aDogc3RyaW5nKTogSnNvblZhbHVlIHtcbiAgY29uc3QgY2xpT3B0aW9uVHlwZSA9IHZhbGlkQ2xpUGF0aHMuZ2V0KHBhdGgpO1xuICBpZiAoY2xpT3B0aW9uVHlwZSkge1xuICAgIHN3aXRjaCAoY2xpT3B0aW9uVHlwZSkge1xuICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgIGlmICh2YWx1ZS50cmltKCkgPT09ICd0cnVlJykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLnRyaW0oKSA9PT0gJ2ZhbHNlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgIGNvbnN0IG51bWJlclZhbHVlID0gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obnVtYmVyVmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIG51bWJlclZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZSB0eXBlOyBleHBlY3RlZCBhICR7Y2xpT3B0aW9uVHlwZX0uYCk7XG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcGFyc2VKc29uKHZhbHVlLCBKc29uUGFyc2VNb2RlLkxvb3NlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uICYmICF2YWx1ZS5zdGFydHNXaXRoKCd7JykpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdmFsdWU7XG59XG5cbmV4cG9ydCBjbGFzcyBDb25maWdDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIHB1YmxpYyByZWFkb25seSBuYW1lID0gJ2NvbmZpZyc7XG4gIHB1YmxpYyByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdHZXQvc2V0IGNvbmZpZ3VyYXRpb24gdmFsdWVzLic7XG4gIHB1YmxpYyByZWFkb25seSBhcmd1bWVudHMgPSBbJ2pzb25QYXRoJywgJ3ZhbHVlJ107XG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBPcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICBuYW1lOiAnZ2xvYmFsJyxcbiAgICAgIHR5cGU6IEJvb2xlYW4sXG4gICAgICAnZGVmYXVsdCc6IGZhbHNlLFxuICAgICAgYWxpYXNlczogWydnJ10sXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldC9zZXQgdGhlIHZhbHVlIGluIHRoZSBnbG9iYWwgY29uZmlndXJhdGlvbiAoaW4geW91ciBob21lIGRpcmVjdG9yeSkuJyxcbiAgICB9LFxuICBdO1xuXG4gIHB1YmxpYyBydW4ob3B0aW9uczogQ29uZmlnT3B0aW9ucykge1xuICAgIGNvbnN0IGxldmVsID0gb3B0aW9ucy5nbG9iYWwgPyAnZ2xvYmFsJyA6ICdsb2NhbCc7XG5cbiAgICBsZXQgY29uZmlnID1cbiAgICAgIChnZXRXb3Jrc3BhY2UobGV2ZWwpIGFzIHt9IGFzIHsgX3dvcmtzcGFjZTogZXhwZXJpbWVudGFsLndvcmtzcGFjZS5Xb3Jrc3BhY2VTY2hlbWEgfSk7XG5cbiAgICBpZiAob3B0aW9ucy5nbG9iYWwgJiYgIWNvbmZpZykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKG1pZ3JhdGVMZWdhY3lHbG9iYWxDb25maWcoKSkge1xuICAgICAgICAgIGNvbmZpZyA9XG4gICAgICAgICAgICAoZ2V0V29ya3NwYWNlKGxldmVsKSBhcyB7fSBhcyB7IF93b3Jrc3BhY2U6IGV4cGVyaW1lbnRhbC53b3Jrc3BhY2UuV29ya3NwYWNlU2NoZW1hIH0pO1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmluZm8odGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgV2UgZm91bmQgYSBnbG9iYWwgY29uZmlndXJhdGlvbiB0aGF0IHdhcyB1c2VkIGluIEFuZ3VsYXIgQ0xJIDEuXG4gICAgICAgICAgICBJdCBoYXMgYmVlbiBhdXRvbWF0aWNhbGx5IG1pZ3JhdGVkLmApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMudmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIWNvbmZpZykge1xuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignTm8gY29uZmlnIGZvdW5kLicpO1xuXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5nZXQoY29uZmlnLl93b3Jrc3BhY2UsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5zZXQob3B0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXQoY29uZmlnOiBleHBlcmltZW50YWwud29ya3NwYWNlLldvcmtzcGFjZVNjaGVtYSwgb3B0aW9uczogQ29uZmlnT3B0aW9ucykge1xuICAgIGxldCB2YWx1ZTtcbiAgICBpZiAob3B0aW9ucy5qc29uUGF0aCkge1xuICAgICAgdmFsdWUgPSBnZXRWYWx1ZUZyb21QYXRoKGNvbmZpZyBhcyB7fSBhcyBKc29uT2JqZWN0LCBvcHRpb25zLmpzb25QYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSBjb25maWc7XG4gICAgfVxuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdWYWx1ZSBjYW5ub3QgYmUgZm91bmQuJyk7XG5cbiAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09ICdvYmplY3QnKSB7XG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKEpTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCAyKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8odmFsdWUudG9TdHJpbmcoKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXQob3B0aW9uczogQ29uZmlnT3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5qc29uUGF0aCB8fCAhb3B0aW9ucy5qc29uUGF0aC50cmltKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQYXRoLicpO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy5nbG9iYWxcbiAgICAgICAgJiYgIW9wdGlvbnMuanNvblBhdGguc3RhcnRzV2l0aCgnc2NoZW1hdGljcy4nKVxuICAgICAgICAmJiAhdmFsaWRDbGlQYXRocy5oYXMob3B0aW9ucy5qc29uUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQYXRoLicpO1xuICAgIH1cblxuICAgIGNvbnN0IFtjb25maWcsIGNvbmZpZ1BhdGhdID0gZ2V0V29ya3NwYWNlUmF3KG9wdGlvbnMuZ2xvYmFsID8gJ2dsb2JhbCcgOiAnbG9jYWwnKTtcbiAgICBpZiAoIWNvbmZpZyB8fCAhY29uZmlnUGF0aCkge1xuICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0NvbmZndXJhdGlvbiBmaWxlIGNhbm5vdCBiZSBmb3VuZC4nKTtcblxuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogTW9kaWZ5ICYgc2F2ZSB3aXRob3V0IGRlc3Ryb3lpbmcgY29tbWVudHNcbiAgICBjb25zdCBjb25maWdWYWx1ZSA9IGNvbmZpZy52YWx1ZTtcblxuICAgIGNvbnN0IHZhbHVlID0gbm9ybWFsaXplVmFsdWUob3B0aW9ucy52YWx1ZSB8fCAnJywgb3B0aW9ucy5qc29uUGF0aCk7XG4gICAgY29uc3QgcmVzdWx0ID0gc2V0VmFsdWVGcm9tUGF0aChjb25maWdWYWx1ZSwgb3B0aW9ucy5qc29uUGF0aCwgdmFsdWUpO1xuXG4gICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignVmFsdWUgY2Fubm90IGJlIGZvdW5kLicpO1xuXG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFsaWRhdGVXb3Jrc3BhY2UoY29uZmlnVmFsdWUpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlci5mYXRhbChlcnJvci5tZXNzYWdlKTtcblxuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0ID0gSlNPTi5zdHJpbmdpZnkoY29uZmlnVmFsdWUsIG51bGwsIDIpO1xuICAgIHdyaXRlRmlsZVN5bmMoY29uZmlnUGF0aCwgb3V0cHV0KTtcbiAgfVxuXG59XG4iXX0=