(function() {
    'use strict';
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var themePreference = localStorage.getItem('theme');
    var odsekPreference = localStorage.getItem('odsek') || 'si';
    var isDark = themePreference === 'dark' || (!themePreference && systemDark);
    if (isDark) {
        document.documentElement.classList.add('dark');
    }
    document.documentElement.classList.add(odsekPreference);

    function getAccordionKey(accordion) {
        return location.pathname + ':' + accordion.firstElementChild.firstElementChild.textContent;
    }

    function isAccordionOpen(accordion) {
        var accordionKey = getAccordionKey(accordion);
        var allAccordions = JSON.parse(localStorage.getItem('accordions') || '{}');
        return allAccordions[accordionKey];
    }

    function setAccordionOpen(accordion, isOpen) {
        var accordionKey = getAccordionKey(accordion);
        var allAccordions = JSON.parse(localStorage.getItem('accordions') || '{}');
        if (isOpen) {
            allAccordions[accordionKey] = true;
        } else {
            delete allAccordions[accordionKey];
        }
        localStorage.setItem('accordions', JSON.stringify(allAccordions));
    }

    document.addEventListener('DOMContentLoaded', function() {
        'use strict';
        var mobileMenu = document.getElementById('mobile-menu');
        var mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        var themeToggle = document.getElementById('theme-toggle');
        var odsekToggle = document.getElementById('odsek-toggle');
        themeToggle.firstElementChild.firstElementChild.setAttribute('href', isDark ? '#moon' : '#sun');
        odsekToggle.firstElementChild.textContent = odsekPreference.toUpperCase();
        mobileMenuToggle.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
        themeToggle.addEventListener('click', function() {
            isDark = !isDark;
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            themeToggle.firstElementChild.firstElementChild.setAttribute('href', isDark ? '#moon' : '#sun');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
        odsekToggle.addEventListener('click', function() {
            document.documentElement.classList.remove(odsekPreference);
            odsekPreference = (odsekPreference === 'si') ? 'rti' : 'si';
            document.documentElement.classList.add(odsekPreference);
            localStorage.setItem('odsek', odsekPreference);
            odsekToggle.firstElementChild.textContent = odsekPreference.toUpperCase();
        });
        var accordions = document.getElementsByClassName('accordion');
        for (var i = 0, l = accordions.length; i < l; ++i) {
            if (isAccordionOpen(accordions[i])) {
                accordions[i].classList.add('open');
                accordions[i].querySelector('div > svg > use').setAttribute('href', '#chevron-up');
            }
            accordions[i].firstElementChild.addEventListener('click', function(event) {
                var accordion = event.currentTarget.parentElement;
                var isOpen = !accordion.classList.contains('open');
                setAccordionOpen(accordion, isOpen);
                accordion.classList.toggle('open');
                accordion.querySelector('div > svg > use').setAttribute('href', isOpen ?
                    '#chevron-up' :
                    '#chevron-down'
                );
            });
        }
    });
})();
