#!/usr/bin/env node
import {isVideoFile, itemPath, readJSON, writeJSON} from './util.js';

async function main() {
    const items = await readJSON('items.json');
    const videos = items.filter(item => isVideoFile(item.name));
    const videoMap = {};
    for (const video of videos) {
        videoMap[itemPath(video)] = video.name;
    }
    await writeJSON('names.json', videoMap);
}

main();
