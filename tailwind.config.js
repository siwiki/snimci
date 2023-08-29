const typography = require('@tailwindcss/typography');

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './layouts/**/*.html',
        './content/**/*.md'
    ],
    darkMode: 'class',
    plugins: [typography],
};
