(function() {
    'use strict';
    var semesters = null;

    function onKeyDown(event) {
        var number = Number(event.key);
        if (number > 0 && number < 9) {
            semesters.children[number - 1].click();
        }
    }

    function onLoad() {
        semesters = document.getElementById('semester-list');
        document.addEventListener('keydown', onKeyDown);
    }

    document.addEventListener('DOMContentLoaded', onLoad);
})();
