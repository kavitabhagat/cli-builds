"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-global-tslint-disable no-any
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const tools_1 = require("@angular-devkit/schematics/tools");
class UnknownCollectionError extends Error {
    constructor(collectionName) {
        super(`Invalid collection (${collectionName}).`);
    }
}
exports.UnknownCollectionError = UnknownCollectionError;
const engineHost = new tools_1.NodeModulesEngineHost();
const engine = new schematics_1.SchematicEngine(engineHost);
// Add support for schemaJson.
const registry = new core_1.schema.CoreSchemaRegistry(schematics_1.formats.standardFormats);
engineHost.registerOptionsTransform(tools_1.validateOptionsWithSchema(registry));
function getEngineHost() {
    return engineHost;
}
exports.getEngineHost = getEngineHost;
function getEngine() {
    return engine;
}
exports.getEngine = getEngine;
function getCollection(collectionName) {
    const engine = getEngine();
    const collection = engine.createCollection(collectionName);
    if (collection === null) {
        throw new UnknownCollectionError(collectionName);
    }
    return collection;
}
exports.getCollection = getCollection;
function getSchematic(collection, schematicName, allowPrivate) {
    return collection.createSchematic(schematicName, allowPrivate);
}
exports.getSchematic = getSchematic;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hdGljcy5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhci9jbGkvdXRpbGl0aWVzL3NjaGVtYXRpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCxpREFBaUQ7QUFDakQsK0NBQThDO0FBQzlDLDJEQU1vQztBQUNwQyw0REFLMEM7QUFFMUMsNEJBQW9DLFNBQVEsS0FBSztJQUMvQyxZQUFZLGNBQXNCO1FBQ2hDLEtBQUssQ0FBQyx1QkFBdUIsY0FBYyxJQUFJLENBQUMsQ0FBQztJQUNuRCxDQUFDO0NBQ0Y7QUFKRCx3REFJQztBQUVELE1BQU0sVUFBVSxHQUFHLElBQUksNkJBQXFCLEVBQUUsQ0FBQztBQUMvQyxNQUFNLE1BQU0sR0FDUixJQUFJLDRCQUFlLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFcEMsOEJBQThCO0FBQzlCLE1BQU0sUUFBUSxHQUFHLElBQUksYUFBTSxDQUFDLGtCQUFrQixDQUFDLG9CQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDeEUsVUFBVSxDQUFDLHdCQUF3QixDQUFDLGlDQUF5QixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFHekU7SUFDRSxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFGRCxzQ0FFQztBQUNEO0lBQ0UsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRkQsOEJBRUM7QUFFRCx1QkFBOEIsY0FBc0I7SUFDbEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxFQUFFLENBQUM7SUFDM0IsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRTNELEVBQUUsQ0FBQyxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sSUFBSSxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsTUFBTSxDQUFDLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBVEQsc0NBU0M7QUFFRCxzQkFBNkIsVUFBZ0MsRUFDaEMsYUFBcUIsRUFDckIsWUFBc0I7SUFDakQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQ2pFLENBQUM7QUFKRCxvQ0FJQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gdHNsaW50OmRpc2FibGU6bm8tZ2xvYmFsLXRzbGludC1kaXNhYmxlIG5vLWFueVxuaW1wb3J0IHsgc2NoZW1hIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtcbiAgQ29sbGVjdGlvbixcbiAgRW5naW5lLFxuICBTY2hlbWF0aWMsXG4gIFNjaGVtYXRpY0VuZ2luZSxcbiAgZm9ybWF0cyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtcbiAgRmlsZVN5c3RlbUNvbGxlY3Rpb25EZXNjLFxuICBGaWxlU3lzdGVtU2NoZW1hdGljRGVzYyxcbiAgTm9kZU1vZHVsZXNFbmdpbmVIb3N0LFxuICB2YWxpZGF0ZU9wdGlvbnNXaXRoU2NoZW1hLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90b29scyc7XG5cbmV4cG9ydCBjbGFzcyBVbmtub3duQ29sbGVjdGlvbkVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihjb2xsZWN0aW9uTmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoYEludmFsaWQgY29sbGVjdGlvbiAoJHtjb2xsZWN0aW9uTmFtZX0pLmApO1xuICB9XG59XG5cbmNvbnN0IGVuZ2luZUhvc3QgPSBuZXcgTm9kZU1vZHVsZXNFbmdpbmVIb3N0KCk7XG5jb25zdCBlbmdpbmU6IEVuZ2luZTxGaWxlU3lzdGVtQ29sbGVjdGlvbkRlc2MsIEZpbGVTeXN0ZW1TY2hlbWF0aWNEZXNjPlxuICA9IG5ldyBTY2hlbWF0aWNFbmdpbmUoZW5naW5lSG9zdCk7XG5cbi8vIEFkZCBzdXBwb3J0IGZvciBzY2hlbWFKc29uLlxuY29uc3QgcmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeShmb3JtYXRzLnN0YW5kYXJkRm9ybWF0cyk7XG5lbmdpbmVIb3N0LnJlZ2lzdGVyT3B0aW9uc1RyYW5zZm9ybSh2YWxpZGF0ZU9wdGlvbnNXaXRoU2NoZW1hKHJlZ2lzdHJ5KSk7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEVuZ2luZUhvc3QoKSB7XG4gIHJldHVybiBlbmdpbmVIb3N0O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEVuZ2luZSgpOiBFbmdpbmU8RmlsZVN5c3RlbUNvbGxlY3Rpb25EZXNjLCBGaWxlU3lzdGVtU2NoZW1hdGljRGVzYz4ge1xuICByZXR1cm4gZW5naW5lO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZTogc3RyaW5nKTogQ29sbGVjdGlvbjxhbnksIGFueT4ge1xuICBjb25zdCBlbmdpbmUgPSBnZXRFbmdpbmUoKTtcbiAgY29uc3QgY29sbGVjdGlvbiA9IGVuZ2luZS5jcmVhdGVDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcblxuICBpZiAoY29sbGVjdGlvbiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBVbmtub3duQ29sbGVjdGlvbkVycm9yKGNvbGxlY3Rpb25OYW1lKTtcbiAgfVxuXG4gIHJldHVybiBjb2xsZWN0aW9uO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2NoZW1hdGljKGNvbGxlY3Rpb246IENvbGxlY3Rpb248YW55LCBhbnk+LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWF0aWNOYW1lOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93UHJpdmF0ZT86IGJvb2xlYW4pOiBTY2hlbWF0aWM8YW55LCBhbnk+IHtcbiAgcmV0dXJuIGNvbGxlY3Rpb24uY3JlYXRlU2NoZW1hdGljKHNjaGVtYXRpY05hbWUsIGFsbG93UHJpdmF0ZSk7XG59XG4iXX0=