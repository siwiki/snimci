#!/usr/bin/env node
import oneDriveAPI from 'onedrive-api';
import {authenticate} from './auth.js';
import {ROOT_DIR, getSharedDriveByName, itemPath, logError, readJSON, writeJSON} from './util.js';
import {SingleBar} from 'cli-progress';

/**
 * @see https://stackoverflow.com/a/68703218
 */
function longestCommonPrefix(words) {
    let i = 0;
    while (words[0][i] && words.every(w => w[i] === words[0][i])) {
        ++i;
    }
    return words[0].substr(0, i);
}

async function getLinks(accessToken, items, driveId) {
    const linkMap = {};
    const progress = new SingleBar({
        format: '[{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total} | {item}'
    });
    progress.start(items.length, 0, {
        item: 'N/A'
    });
    for (const item of items) {
        progress.update({
            item: itemPath(item)
        });
        try {
            const permissions = await oneDriveAPI.items.customEndpoint({
                accessToken,
                url: `drives/${driveId}/items/${item.id}/permissions`,
                method: 'GET'
            });
            const shareLinks = permissions.value.filter(p => p.link);
            for (const link of shareLinks) {
                if (!linkMap[link.id]) {
                    linkMap[link.id] = link.link;
                    linkMap[link.id].dirs = [];
                }
                linkMap[link.id].dirs.push(itemPath(item));
            }
        } catch (error) {
            logError(error, 'Failed to fetch item', item.id);
        }
        progress.increment();
    }
    progress.stop();
    const links = Object.values(linkMap);
    for (const link of links) {
        link.dir = longestCommonPrefix(link.dirs);
        delete link.dirs;
    }
    return links;
}

async function main() {
    try {
        const accessToken = await authenticate();
        const drive = await getSharedDriveByName(accessToken, ROOT_DIR);
        const items = await readJSON('items.json');
        const links = await getLinks(accessToken, items, drive.remoteItem.parentReference.driveId);
        await writeJSON('links.json', links);
    } catch (error) {
        logError(error);
    }
}

main();
