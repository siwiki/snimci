#!/usr/bin/env node
import oneDriveAPI from 'onedrive-api';
import {authenticate} from './auth.js';
import {ROOT_DIR, getSharedDriveByName, itemPath, readJSON} from './util.js';
import {basename} from 'path';
import {argv} from 'process';

async function rename(accessToken, itemId, newName, drive, driveId) {
    await oneDriveAPI.items.update({
        accessToken,
        drive,
        driveId,
        itemId,
        toUpdate: {
            name: newName
        }
    })
}

async function main() {
    const items = await readJSON('items.json');
    const names = await readJSON('names.json');
    const namesToChange = Object
        .entries(names)
        .filter(([original, changed]) => basename(original) !== changed);
    console.log(namesToChange.length, 'names to change');
    const accessToken = await authenticate();
    const drive = await getSharedDriveByName(accessToken, ROOT_DIR);
    for (const [original, changed] of namesToChange) {
        const item = items.find(i => itemPath(i) === original);
        if (!item) {
            console.error('Could not find item', original);
            continue;
        }
        console.info(original);
        if (!argv.includes('--dry-run')) {
            await rename(accessToken, item.id, changed, 'drive', drive.remoteItem.parentReference.driveId);
        }
    }
}

main();
