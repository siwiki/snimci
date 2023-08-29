#!/usr/bin/env node
import oneDriveAPI from 'onedrive-api';
import {authenticate} from './auth.js';
import {analyze} from './analysis.js';
import {ROOT_DIR, getSharedDriveByName, itemPath, logError, readJSON, writeJSON} from './util.js';
import {SingleBar} from 'cli-progress';

async function generateLinks(accessToken, items, drive, driveId) {
    const links = [];
    const progress = new SingleBar({
        format: '[{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total} | {item}'
    });
    progress.start(items.length, 0, {
        item: 'N/A'
    });
    for (const item of items) {
        const dir = itemPath(item);
        progress.update({
            item: dir
        });
        const permission = await oneDriveAPI.items.createLink({
            accessToken,
            body: {
                scope: 'organization'
            },
            drive,
            driveId,
            itemId: item.id,
            type: 'view'
        });
        links.push({
            ...permission.link,
            dir
        });
        progress.increment();
    }
    progress.stop();
    return links;
}

function getNeededLinks(analysis) {
    const neededLinks = [];
    for (const {name, hasMaterials, categories} of analysis) {
        const subjectDir = `${ROOT_DIR}/${name}`;
        neededLinks.push(subjectDir);
        if (hasMaterials) {
            neededLinks.push(`${subjectDir}/Materijali`);
        }
        for (const category of categories) {
            if (category.files) {
                const categoryDir = `${subjectDir}/${category.folder}`;
                neededLinks.push(
                    categoryDir,
                    ...category.files.map(file => `${categoryDir}/${file.file}`)
                );
            } else {
                for (const subcategory of category.subcategories) {
                    const subcategoryDir = `${subjectDir}/${category.folder}/${subcategory.folder}`;
                    neededLinks.push(
                        subcategoryDir,
                        ...subcategory.files.map(file => `${subcategoryDir}/${file.file}`)
                    );
                }
            }
        }
    }
    return neededLinks;
}

async function main() {
    try {
        const items = await readJSON('items.json');
        const links = await readJSON('links.json');
        const analysis = analyze(items);
        const neededLinks = getNeededLinks(analysis);
        const existentLinks = new Set(
            links
                .filter(link => link.scope === 'organization' && link.type === 'view')
                .map(link => link.dir)
        );
        const availableLinks = neededLinks.filter(link => existentLinks.has(link));
        const missingLinks = neededLinks.filter(link => !existentLinks.has(link));
        const numUnneededLinks = existentLinks.size - availableLinks.length;
        console.info('Found links:', availableLinks.length);
        console.info('Not found links:', missingLinks.length);
        console.info('Unneeded links:', numUnneededLinks);
        if (missingLinks.length === 0) {
            return;
        }
        console.info('Creating missing links...');
        const accessToken = await authenticate();
        const drive = await getSharedDriveByName(accessToken, ROOT_DIR);
        const driveId = drive.remoteItem.parentReference.driveId;
        const linkItems = missingLinks.map(link => items.find(item => itemPath(item) === link));
        if (linkItems.some(item => !item)) {
            console.error('Cannot find some link items!');
            return;
        }
        const newLinks = await generateLinks(accessToken, linkItems, 'drive', driveId);
        await writeJSON('links.json', [...links, ...newLinks]);
    } catch (error) {
        logError(error);
    }
}

main();

