import {readFile, writeFile} from 'fs/promises';
import oneDriveAPI from 'onedrive-api';

export const ROOT_DIR = 'Snimci predavanja';

export async function getSharedDriveByName(accessToken, name) {
    const items = await oneDriveAPI.items.customEndpoint({
        accessToken,
        url: 'me/drive/sharedWithMe',
        method: 'GET'
    });
    return items.value.find(drive => drive.name === name);
}

export async function getFolderFromRoot(accessToken, name) {
    const items = await oneDriveAPI.items.listChildren({
        accessToken,
        itemId: 'root'
    });
    return items.value.find(item => item.name === name);
}

export function writeJSON(fileName, data) {
    return writeFile(fileName, JSON.stringify(data, null, '    '), {
        encoding: 'utf-8'
    });
}

export async function readJSON(fileName) {
    return JSON.parse(await readFile(fileName, {
        encoding: 'utf-8'
    }));
}

export function itemPath(driveItem) {
    const parentPath = driveItem.parentReference.path;
    if (!parentPath) {
        return decodeURIComponent(driveItem.webUrl
            .replace(`${driveItem.sharepointIds.siteUrl}/Documents/`));
    }
    if (parentPath.endsWith('/root:')) {
        return driveItem.name;
    }
    const trimmedParentPath = parentPath
        .replace(/^[^:]*\/root:\//, '');
    return `${trimmedParentPath}/${driveItem.name}`;
}

export async function getAllItems(accessToken, driveItem, drive, driveId, progress) {
    if (progress) {
        progress.update({
            item: itemPath(driveItem)
        });
    }
    const items = await oneDriveAPI.items.listChildren({
        accessToken,
        drive,
        driveId,
        itemId: driveItem.id
    });
    const folders = items.value.filter(item => item.folder);
    if (progress) {
        progress.setTotal(progress.getTotal() + folders.length);
        progress.increment(1);
    }
    const folderItems = [];
    for (const folder of folders) {
        folderItems.push(...await getAllItems(accessToken, folder, drive, driveId, progress));
    }
    return [...items.value, ...folderItems];
}

export function isVideoFile(fileName) {
    return fileName.endsWith('.mp4') ||
           fileName.endsWith('.mkv') ||
           fileName.endsWith('.wmv') ||
           fileName.endsWith('.mov') ||
           fileName.endsWith('.m4a') ||
           fileName.endsWith('.webm') ||
           fileName.endsWith('.avi');
}

export function logError(error, ...args) {
    if (error && error.response && error.response.body) {
        console.error(...args, error.response.body);
    } else {
        console.error(...args, error);
    }
}
