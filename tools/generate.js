#!/usr/bin/env node
import {analyze} from './analysis.js';
import {ROOT_DIR, readJSON} from './util.js';
import {parse, stringify} from './yaml.js';
import {stat} from 'fs/promises';

const SOURCE_ID = 'savic';

const SLUGIFICATION = {
    'č': 'c',
    'ć': 'c',
    'ž': 'z',
    'đ': 'dj',
    'š': 's',
    ',': '',
    '/': '-',
    '.': '',
    ' ': '-'
};

function findLinkByDir(links, dir) {
    return links.find(link => link.dir === dir);
}

async function fileExists(path) {
    try {
        await stat(path);
        return true;
    } catch (error) {
        return false;
    }
}

function updateMaterials(header, links, subject) {
    header.materials = header.materials || [{
        label: 'Nastavni materijali',
        links: []
    }];
    const materialLinks = header.materials[0].links;
    const materialsDir = `${ROOT_DIR}/${subject}/Materijali`;
    const materialLink = findLinkByDir(links, materialsDir);
    if (materialLink) {
        const sourceLink = materialLinks.find(link => link.source === SOURCE_ID);
        if (sourceLink) {
            sourceLink.location = materialLink.webUrl;
            sourceLink.path = materialsDir;
        } else {
            materialLinks.push({
                source: SOURCE_ID,
                location: materialLink.webUrl,
                path: materialsDir
            });
        }
    } else {
        console.error('Material links for', subject, 'not found!');
    }
}

function updateSources(header, links, subject) {
    const subjectDir = `${ROOT_DIR}/${subject}`;
    header.sources = header.sources || [];
    const sourceLink = findLinkByDir(links, subjectDir);
    if (sourceLink) {
        const source = header.sources.find(link => link.source === SOURCE_ID);
        if (source) {
            source.location = sourceLink.webUrl;
            source.path = subjectDir;
        } else {
            header.sources.push({
                source: SOURCE_ID,
                location: sourceLink.webUrl,
                path: subjectDir
            });
        }
    } else {
        console.error('Source link not found for', subject);
    }
}

function slugify(name) {
    let sluggified = name.toLowerCase();
    for (const [letter, replacement] of Object.entries(SLUGIFICATION)) {
        sluggified = sluggified.replaceAll(letter, replacement);
    }
    return sluggified;
}

function areVideosEqual(analysisVideo, yamlVideo) {
    return analysisVideo.description === yamlVideo.title &&
           analysisVideo.date === yamlVideo.date &&
           analysisVideo.number === yamlVideo.number &&
           analysisVideo.header === yamlVideo.header;
}

function mapAnalysisVideoIntoYaml(video, links, dir) {
    const fileLink = `${dir}/${video.file}`;
    const foundLink = findLinkByDir(links, fileLink);
    if (foundLink) {
        return {
            title: video.description,
            date: video.date || undefined,
            number: video.number || undefined,
            header: video.header,
            links: [{
                source: SOURCE_ID,
                location: foundLink.webUrl,
                path: fileLink
            }]
        };
    } else {
        console.error('No link found for', fileLink);
        return null;
    }
}

function updateVideoLinks(yamlVideos, analysisVideos, links, dir) {
    for (const yamlVideo of yamlVideos) {
        const associatedVideo = analysisVideos
            .find(analysisVideo => areVideosEqual(analysisVideo, yamlVideo));
        if (!associatedVideo) {
            console.error('Could not associate any video with', yamlVideo);
            continue;
        }
        const videoPath = `${dir}/${associatedVideo.file}`;
        const link = findLinkByDir(links, videoPath);
        if (!link) {
            console.error('Video', videoPath, 'does not have an existent link');
            continue;
        }
        const existentLink = yamlVideo.links.find(link => link.source === SOURCE_ID);
        if (existentLink) {
            existentLink.path = videoPath;
            existentLink.location = findLinkByDir(links, videoPath).webUrl;
        } else {
            yamlVideo.links.push({
                source: SOURCE_ID,
                location: findLinkByDir(links, videoPath),
                path: videoPath
            });
        }
    }
}

async function updateCategories(header, links, subject, subcategories) {
    const subjectDir = `${ROOT_DIR}/${subject}`;
    // header.categories = header.categories || [];
    header.categories = [];
    const existentSubcats = header.categories
        .map(cat => cat.contents.filter(subcat => subcat.name))
        .flat();
    const existentVideos = header.categories
        .map(cat => cat.contents.filter(subcat => subcat.title))
        .flat();
    const missingSubcats = subcategories
        .filter(subcat => subcat.name !== '<plain>' && !existentSubcats
            .some(subcat2 => subcat.category === subcat2.header &&
                             subcat.name === subcat2.name));
    const allVideos = subcategories
        .filter(subcat => subcat.name === '<plain>')
        .map(subcat => Object.entries(subcat.years)
            .map(([year, videos]) => videos.map(video => ({
                ...video,
                header: year ?
                    `${subcat.category} ${year}` :
                    subcat.category,
                file: year ?
                    `${subcat.category} ${year}/${video.file}` :
                    `${subcat.category}/${video.file}`
            }))))
        .flat(2);
    const missingVideos = allVideos
        .filter(video => !existentVideos
            .some(video2 => areVideosEqual(video, video2)));
    if (missingSubcats.length > 0 || missingVideos.length > 0) {
        header.categories.push({
            label: 'Nekategorizovano',
            headers: Array.from(new Set([...missingSubcats, ...missingVideos]
                .map(item => item.header || item.category))),
            contents: [
                ...missingSubcats
                    .map(subcat => ({
                        header: subcat.category,
                        number: subcat.number,
                        name: `${slugify(subcat.category)}-${slugify(subcat.name)}`
                    })),
                ...missingVideos
                    .map(video => mapAnalysisVideoIntoYaml(video, links, subjectDir))
                    .filter(Boolean)
            ]
        });
    }
    updateVideoLinks(existentVideos, allVideos, links, subjectDir);
    for (const video of existentVideos) {
        const associatedVideo = allVideos
            .find(video2 => areVideosEqual(video2, video));
        if (!associatedVideo) {
            console.error('Could not associate any video with', video, allVideos);
            continue;
        }
        const videoPath = `${ROOT_DIR}/${subject}/${associatedVideo.file}`;
        const link = findLinkByDir(links, videoPath);
        if (!link) {
            console.error('Video', videoPath, 'does not have an existent link');
            continue;
        }
        const existentLink = video.links.find(link => link.source === SOURCE_ID);
        if (existentLink) {
            existentLink.path = videoPath;
            existentLink.location = findLinkByDir(links, videoPath).webUrl;
        } else {
            video.links.push({
                source: SOURCE_ID,
                location: findLinkByDir(links, videoPath),
                path: videoPath
            });
        }
    }
}

function updateYear(header, year, dir, videos, links) {
    const foundYear = header.find(y => y.year === year);
    if (foundYear) {
        updateVideoLinks(foundYear.videos, videos, links, dir);
    } else {
        header.push({
            year,
            videos: videos
                .map(video => mapAnalysisVideoIntoYaml(video, links, dir))
                .filter(Boolean)
        });
    }
}

async function updateSubcategory(subject, {category, folder, name, years}, links) {
    const pagePath = `../content/${subject.toLowerCase()}/${slugify(category)}-${slugify(name)}.md`
    // const {header, content} = (await fileExists(pagePath)) ?
    //     (await parse(pagePath)) :
    //     {header: {}, content: ''};
    const header = {};
    const content = '';
    // FIXME: Temp
    header.title = name;
    header.category = category;
    header.years = header.years || [];
    for (const [year, videos] of Object.entries(years)) {
        const subcatFolder = `${subject}/${folder.replace('$1', year)}`;
        updateSources(header, links, subcatFolder);
        updateYear(header.years, year, `${ROOT_DIR}/${subcatFolder}`, videos, links);
    }
    await stringify(pagePath, {
        content,
        header
    });
}

async function updateSubject({name, hasMaterials, subcategories}, links) {
    if (subcategories.length === 0) {
        // This subject most likely does not have its own page.
        return;
    }
    const subjectPageFile = `../content/${name.toLowerCase()}/_index.md`;
    const {header, content} = await parse(subjectPageFile);
    // Updating the page title if there is none set (there should be one).
    if (!header.title) {
        header.title = name;
    }
    // Updating links for materials.
    if (hasMaterials) {
        updateMaterials(header, links, name);
    }
    // Updating links for sources.
    updateSources(header, links, name);
    // Updating links for categories.
    await updateCategories(header, links, name, subcategories);
    // Updating links for subcategories.
    for (const subcategory of subcategories) {
        if (subcategory.name !== '<plain>') {
            await updateSubcategory(name, subcategory, links);
        }
    }
    // Update the file.
    stringify(subjectPageFile, {header, content});
}

async function main() {
    const items = await readJSON('items.json');
    const links = await readJSON('links.json');
    const organizationViewLinks = links.filter(
        link => link.scope === 'organization' &&
                link.type === 'view'
    );
    const numEditOrAnonymousLinks = links.length - organizationViewLinks.length;
    if (numEditOrAnonymousLinks > 0) {
        console.warn('WARNING: There are', numEditOrAnonymousLinks, 'edit or anonymous links');
    }
    const analysis = analyze(items);
    for (const subjectAnalysis of analysis) {
        await updateSubject(subjectAnalysis, links);
    }
}

main();
