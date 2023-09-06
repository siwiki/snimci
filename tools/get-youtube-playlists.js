import {execFile} from 'child_process';
import {promisify} from 'util';
import {readJSON, writeJSON} from './util.js';
import {readdir} from 'fs/promises';
import {parse} from './yaml.js';

const exec = promisify(execFile);

const CHANNEL = '@ETFSI';

async function runYtDlp(link) {
    const {stdout} = await exec('yt-dlp', [
        '-j',
        '--flat-playlist',
        link
    ]);
    return stdout
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
        .map(({id, title, duration}) => ({duration, id, title}));
}

async function getAllSubjectTitles() {
    const contents = await readdir('../content', {
        withFileTypes: true
    });
    const subjectDirs = contents
        .filter(d => d.isDirectory() && d.name !== 'semestar')
        .map(d => d.name);
    const subjectMap = {};
    for (const dir of subjectDirs) {
        const {header} = await parse(`../content/${dir}/_index.md`);
        subjectMap[dir] = header.title.toLowerCase();
    }
    return subjectMap;
}

async function getAllPlaylists(subjectMap) {
    const playlists = await runYtDlp(`https://www.youtube.com/${CHANNEL}/playlists`);
    for (const playlist of playlists) {
        if (playlist.title.includes('Predavanja')) {
            playlist.category = 'Predavanja';
        } else if (playlist.title.includes('Vežbe')) {
            playlist.category = 'Vežbe';
        } else {
            console.error('Could not determine the category of', playlist.title);
        }
        const lowerTitle = playlist.title.toLowerCase();
        for (const [subject, title] of Object.entries(subjectMap)) {
            if (lowerTitle.includes(title)) {
                playlist.subject = subject.toUpperCase();
                break;
            }
        }
        if (!playlist.subject) {
            console.error('Could not find the subject for', playlist.title);
        }
    }
    return playlists;
}

async function getPlaylistVideos(playlistId) {
    const videos = await runYtDlp(`https://www.youtube.com/playlist?list=${playlistId}`);
    for (const video of videos) {
        const numberMatch = video.title.match(/\b\d+\b/);
        if (numberMatch) {
            video.number = Number(numberMatch[0]);
        } else {
            console.error('No number matched in', video.title);
        }
    }
    return videos;
}

function applyPatches(playlists, patches) {
    for (const patch of patches) {
        const playlist = playlists
            .find(p => p.subject === patch.subject &&
                       p.category === patch.category);
        if (!playlist) {
            console.error('Failed to apply patch', patch);
            continue;
        }
        if (patch.year) {
            playlist.year = patch.year;
        }
        if (patch.numberOffset) {
            for (const video of playlist.videos) {
                video.number += patch.numberOffset;
            }
        }
    }
}

async function main() {
    const patches = await readJSON('youtube-patches.json');
    const subjectTitles = await getAllSubjectTitles();
    const playlists = await getAllPlaylists(subjectTitles);
    for (const playlist of playlists) {
        playlist.videos = await getPlaylistVideos(playlist.id);
    }
    applyPatches(playlists, patches);
    await writeJSON('youtube.json', playlists);
}

main();
