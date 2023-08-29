#!/usr/bin/env node
import {authenticate} from './auth.js';
import {ROOT_DIR, getAllItems, getFolderFromRoot, getSharedDriveByName, writeJSON} from './util.js';
import {SingleBar} from 'cli-progress';

async function main() {
    try {
        const accessToken = await authenticate();
        const drive = await getSharedDriveByName(accessToken, ROOT_DIR);
        const progress = new SingleBar({
            format: '[{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total} | {item}'
        });
        progress.start(1, 0, {
            item: ROOT_DIR
        });
        const driveItem = drive.remoteItem;
        const driveId = driveItem.parentReference.driveId;
        const items = await getAllItems(accessToken, driveItem, 'drive', driveId, progress);
        progress.stop();
        writeJSON('items.json', items);
        console.info('Done!');
    } catch (error) {
        if (error.response) {
            console.error(error.response.body);
        } else {
            console.error(error);
        }
    }
}

main();
