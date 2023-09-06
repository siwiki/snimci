import 'dotenv/config';
import {ROOT_DIR, isVideoFile, itemPath} from './util.js';
import {env} from 'process';

const ALLOWED_CATEGORIES = new Set([
    'Predavanja',
    'Vežbe',
    'Konsultacije',
    'Labovi',
    'Projekat',
    // INTSIS, OS2
    'Studentska predavanja',
    // INTSIS
    'Python uvod',
    // PS
    'Vežbe 720p'
]);
const MATERIALS_DIRECTORY = 'Materijali';
const TEACHING_GROUPS = [
    'P1',
    'P2',
    'P3',
    'P4',
    'V1',
    'V2',
    'V3',
    'V4'
];
const DEPARTMENTS = ['SI', 'RTI'];

/**
 * @param {import('@microsoft/microsoft-graph-types').DriveItem[]} items 
 * @param {string} directory 
 * @returns {import('@microsoft/microsoft-graph-types').DriveItem[]}
 */
function getItemsFromDirectory(items, directory) {
    return items
        .filter(item => item.parentReference?.path === `/drives/${item.parentReference?.driveId}/root:/${directory}`);
}

function getListFromEnvVar(envVar) {
    if (!env[envVar]) {
        return [];
    }
    return env[envVar].split(',').map(item => item.trim());
}

function getSubjects(items) {
    const allSubjects = getItemsFromDirectory(items, ROOT_DIR)
        .filter(item => item.folder)
        .map(item => item.name);
    const includeList = getListFromEnvVar('INCLUDE_LIST');
    const excludeList = getListFromEnvVar('EXCLUDE_LIST');
    if (includeList.length > 0) {
        return includeList.filter(item => allSubjects.includes(item));
    }
    if (excludeList.length > 0) {
        return allSubjects.filter(item => !excludeList.includes(item));
    }
    return allSubjects;
}

function analyzeCategoryInfo(info) {
    const analysis = {};
    let processedInfo = info;
    for (const group of TEACHING_GROUPS) {
        if (processedInfo.includes(group)) {
            analysis.group = group;
            processedInfo = processedInfo.replace(group, '');
        }
    }
    for (const department of DEPARTMENTS) {
        if (processedInfo.includes(department)) {
            analysis.department = department;
            processedInfo = processedInfo.replace(department, '');
        }
    }
    const teacher = processedInfo.trim();
    if (teacher) {
        analysis.teacher = teacher;
    }
    return analysis;
}

function isSpecialFile(fileName) {
    return fileName.startsWith('00') || fileName.startsWith('! ');
}

function isDate(str) {
    return /\d{4}-\d{2}-\d{2}/u.test(str);
}

/**
 * Analyzes a file name.
 *
 * It can have one of the five forms:
 * - NUM - YYYY-MM-DD - Description
 * - NUM.NUM - YYYY-MM-DD - Description
 * - YYYY-MM-DD - Description
 * - NUM - Description
 * - NUM.NUM - Description
 * @param {import('@microsoft/microsoft-graph-types').DriveItem[]} items Items
 * in the OneDrive drive
 * @param {string} file File name
 * @param {string} dir File's directory
 * @returns {null|{description: string, number?: number, date?: Date}} Analysis results
 */
function analyzeFile(items, file, dir) {
    const parts = file.replace(/\.[a-z0-9]{3,4}$/u, '').split(' - ');
    if (parts.length < 2 || parts.length > 3) {
        console.error('File', file, 'appears to have an unformatted name');
        return null;
    }
    const description = parts[parts.length - 1];
    const path = `${ROOT_DIR}/${dir}/${file}`;
    const durationMillis = items.find(item => itemPath(item) === path)?.video?.duration;
    const duration = durationMillis ?
        Math.round(durationMillis / 1000) :
        undefined;
    if (description.trim() === '') {
        console.error('File', file, 'is missing a description');
        return null;
    }
    if (isDate(description) || !isNaN(Number(description))) {
        console.error('Unexpected number or date as the last segment of file', file);
        return null;
    }
    if (isDate(parts[0])) {
        if (parts.length === 3) {
            console.error('File', file, 'has the wrong order of parts');
            return null;
        }
        return {
            date: new Date(parts[0]),
            description,
            duration,
            file,
            path
        };
    }
    const number = Number(parts[0].split('.').map(part => Number(part)).join('.'));
    if (isNaN(number)) {
        console.error('Expected number as the first part of', file);
        return null;
    }
    if (parts.length === 3) {
        if (!isDate(parts[1])) {
            console.error('Expected date as the second part of', file);
            return null;
        }
        return {
            date: new Date(parts[1]),
            description,
            duration,
            file,
            number,
            path
        };
    }
    return {
        description,
        duration,
        file,
        number,
        path
    };
}

function analyzeFiles(items, files, dir) {
    const nonVideos = files.filter(file => !isVideoFile(file.name));
    if (nonVideos.length) {
        console.error('Found non-video files!', nonVideos.map(file => file.name));
        return null;
    }
    return files.map(file => analyzeFile(items, file.name, dir)).filter(Boolean);
}

function analyzeSubcategory(items, subject, category, subcategory) {
    const parts = subcategory.split('. ');
    const number = Number(parts[0]);
    if (parts.length === 1 || isNaN(number)) {
        console.error('Subcategory', subcategory, 'does not have a proper name within', subject);
        return null;
    }
    const subcategoryItems = getItemsFromDirectory(items, `${ROOT_DIR}/${subject}/${category}/${subcategory}`);
    const directories = subcategoryItems.filter(item => item.folder);
    const files = subcategoryItems.filter(item => item.file && !isSpecialFile(item.name));
    if (directories.length > 0) {
        console.error('Subcategory', subcategory, 'within', subject, 'contains further subcategories');
        return null;
    }
    return {
        files: analyzeFiles(items, files, `${subject}/${category}/${subcategory}`),
        folder: subcategory,
        name: parts[1],
        number
    };
}

function analyzeCategoryFiles(items, subject, category) {
    const categoryItems = getItemsFromDirectory(items, `${ROOT_DIR}/${subject}/${category}`);
    const directories = categoryItems.filter(item => item.folder);
    const files = categoryItems.filter(item => item.file && !isSpecialFile(item.name));
    if (directories.length === 0) {
        // This hasn't been split into directories.
        return {
            files: analyzeFiles(items, files, `${subject}/${category}`)
        };
    }
    if (files.length > 0) {
        console.error(subject, 'has a category', category, 'with unorganized files');
        return null;
    }
    return {
        subcategories: directories
            .map(cat => analyzeSubcategory(items, subject, category, cat.name))
            .filter(Boolean)
    };
}

/**
 * @param {string} category 
 */
function analyzeCategory(items, subject, category) {
    const parts = category.split(' ');
    const yearIndex = parts.findIndex(part => !isNaN(Number(part)));
    if (yearIndex === -1) {
        return {
            folder: category,
            name: category,
            ...analyzeCategoryFiles(items, subject, category),
        };
    }
    const name = parts.slice(0, yearIndex).join(' ');
    if (name === MATERIALS_DIRECTORY) {
        // Do not analyze further, as this directory has no structure.
        return {name};
    }
    const year = Number(parts[yearIndex]);
    const info = parts.slice(yearIndex + 1).join(' ');
    return {
        folder: category,
        name,
        year,
        ...analyzeCategoryFiles(items, subject, category),
        ...analyzeCategoryInfo(info)
    };
}

// TODO: count in teachers, teaching groups and departments
function analyzeSubcategories(subject, categories) {
    const categoryMap = {};
    for (const {name, files, folder, year, subcategories} of categories) {
        if (!categoryMap[name]) {
            categoryMap[name] = [];
        }
        const plainCat = categoryMap[name].find(subcat => subcat.name === '<plain>');
        if (files) {
            // This category just contains plain files.
            if (categoryMap[name].length > 0 && categoryMap[name][0].name !== '<plain>') {
                console.error('Subject', subject, 'has one plain-file category, and one not');
                continue;
            }
            if (plainCat) {
                plainCat.years[year] = files;
            } else {
                categoryMap[name].push({
                    category: name,
                    name: '<plain>',
                    number: 0,
                    years: {
                        [year || '']: files
                    }
                });
            }
        } else {
            if (plainCat) {
                console.error('Subject', subject, 'has one plain-file category, and one not');
                continue;
            }
            for (const subcategory of subcategories) {
                const prevSubcat = categoryMap[name].find(
                    subcat => subcat.number === subcategory.number &&
                              subcat.category === name
                );
                if (prevSubcat) {
                    if (prevSubcat.name !== subcategory.name) {
                        // We've found a mismatched subcategory with the same number as ours.
                        console.error('Subcategory mismatch on', subcategory.name, 'and', prevSubcat.name);
                        continue;
                    }
                    // We've found a previous subcategory, we update the years it appeared in.
                    prevSubcat.years[year] = subcategory.files;
                } else {
                    // There is no previous subcategory, we create a new one.
                    categoryMap[name].push({
                        category: name,
                        folder: `${folder.replace(year, '$1')}/${subcategory.folder}`,
                        name: subcategory.name,
                        number: subcategory.number,
                        years: {
                            [year || '']: subcategory.files
                        }
                    });
                }
            }
        }
    }
    return Object.values(categoryMap).flat();
}

function analyzeSubject(items, subject) {
    const analysis = {};
    analysis.name = subject;
    const subjectDirectoryItems = getItemsFromDirectory(items, `${ROOT_DIR}/${subject}`);
    if (subjectDirectoryItems.some(item => !item.folder)) {
        console.error(subject, 'directory does not only consist of folders!');
        return null;
    }
    analysis.hasMaterials = Boolean(subjectDirectoryItems.find(item => item.name === MATERIALS_DIRECTORY));
    analysis.categories = subjectDirectoryItems
        .filter(item => item.name !== MATERIALS_DIRECTORY)
        .map(item => analyzeCategory(items, subject, item.name))
        .filter(Boolean);
    analysis.subcategories = analyzeSubcategories(subject, analysis.categories);
    const disallowedCategories = analysis.categories.filter(
        cat => !ALLOWED_CATEGORIES.has(cat.name) &&
               cat.name !== MATERIALS_DIRECTORY
    );
    if (disallowedCategories.length) {
        console.error(subject, 'directory includes disallowed categories:', disallowedCategories);
        return null;
    }
    return analysis;
}

export function analyze(items) {
    const subjects = getSubjects(items);
    const analysis = [];
    for (const subject of subjects) {
        const subjectAnalysis = analyzeSubject(items, subject);
        if (!subjectAnalysis) {
            continue;
        }
        analysis.push(subjectAnalysis);
    }
    return analysis;
}
