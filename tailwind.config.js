const typography = require('@tailwindcss/typography');

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./hugo_stats.json'],
    darkMode: 'class',
    plugins: [typography],
};
