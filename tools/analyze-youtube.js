import {analyze} from './analysis.js';

const ALLOWED_DURATION_DELTA = 5;

export function analyzeYoutube(items, youtube) {
    const analysis = analyze(items);
    for (const subjectAnalysis of analysis) {
        const subjectPlaylists = youtube
            .filter(playlist => playlist.subject === subjectAnalysis.name);
        if (subjectPlaylists.length === 0) {
            console.warn('No playlists for', subjectAnalysis.name);
            continue;
        }
        for (const subcategory of subjectAnalysis.subcategories) {
            if (!['Predavanja', 'Vežbe'].includes(subcategory.category)) {
                continue;
            }
            const subcategoryYears = Object.keys(subcategory.years);
            const subcategoryPlaylists = subjectPlaylists
                .filter(playlist => playlist.category === subcategory.category &&
                                    subcategoryYears.includes(String(playlist.year || '')));
            if (subcategoryPlaylists.length !== 1) {
                console.error('Found', subcategoryPlaylists.length, 'playlists for subcategory', subcategory.name);
                console.log(subjectPlaylists, subcategory.category, subcategoryYears);
                continue;
            }
            const [playlist] = subcategoryPlaylists;
            const subcategoryYear = subcategoryYears
                .find(y => Number(y) === (playlist.year || 0));
            const videos = subcategory.years[subcategoryYear];
            for (const youtubeVideo of playlist.videos) {
                const associatedVideos = videos
                    .filter(video => youtubeVideo.number === Math.round(video.number));
                if (associatedVideos.length === 0) {
                    continue;
                }
                if (associatedVideos.some(v => !v.duration)) {
                    console.error('Not all associated videos have duration metadata for', youtubeVideo.title);
                    continue;
                }
                const totalDuration = associatedVideos
                    .reduce((total, current) => total + current.duration, 0);
                if (Math.abs(totalDuration - youtubeVideo.duration) > ALLOWED_DURATION_DELTA) {
                    console.error('Duration differences in', youtubeVideo.title, 'please adjust video number offsets');
                }
                for (const [index, associatedVideo] of associatedVideos.entries()) {
                    associatedVideo.youtube = youtubeVideo.id;
                    associatedVideo.youtubePlaylist = playlist.id;
                    if (index > 0) {
                        associatedVideo.youtubeT = associatedVideos
                            .slice(0, index)
                            .reduce((total, current) => total + current.duration, 0);
                    }
                }
            }
        }
    }
    return analysis;
}
