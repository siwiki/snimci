(function() {
    'use strict';
    var videoCards = [];
    var modal = null;
    var modalContent = null;
    var modalTitle = null;
    var nextVideoButton;
    var prevVideoButton;

    var VIDEO_ASPECT_RATION = 16 / 9;
    var MAX_EMBED_WIDTH = 960;
    var embedWidth;
    var embedHeight;
    var cardId;

    function openCard(card) {
        var content = card.querySelector('.modal-content');
        var title = card.querySelector('h5');
        var newContent = content.cloneNode(true);
        var youTubeButton = newContent.querySelector('.youtube-button');
        newContent.classList.remove('hidden');
        modal.classList.remove('hidden');
        while (modalContent.firstChild) {
            modalContent.removeChild(modalContent.firstChild);
        }
        modalContent.appendChild(newContent);
        modalTitle.textContent = title.textContent;
        var isMobile = navigator.userAgentData && navigator.userAgentData.mobile;
        if (youTubeButton && !isMobile) {
            var embed = document.createElement('iframe');
            embed.width = embedWidth;
            embed.height = embedHeight;
            embed.allow = 'encrypted-media; fullscreen';
            var src = 'https://www.youtube-nocookie.com/embed/' + youTubeButton.dataset.id;
            if (youTubeButton.dataset.start) {
                src += '?start=' + youTubeButton.dataset.start;
            }
            embed.src = src;
            window.a = youTubeButton;
            window.b = embed;
            youTubeButton.replaceWith(embed);
        }
        cardId = Number(card.dataset.id);
        prevVideoButton.disabled = cardId === 0;
        nextVideoButton.disabled = cardId === videoCards.length - 1;
    }

    function onCardClick(event) {
        openCard(event.currentTarget);
    }

    function onModalClose() {
        modal.classList.add('hidden');
        var embed = modalContent.querySelector('iframe');
        if (embed) {
            embed.remove();
        }
    }

    function onClickInside(event) {
        event.stopPropagation();
    }

    function onChangeVideo(offset) {
        var offsetCardId = cardId + offset;
        if (offsetCardId === 0 || offsetCardId === videoCards.length - 1) {
            return;
        }
        openCard(videoCards[offsetCardId]);
    }

    function onLoad() {
        var content = document.getElementById('content');
        embedWidth = Math.min(content.clientWidth, MAX_EMBED_WIDTH);
        embedHeight = embedWidth / VIDEO_ASPECT_RATION;
        modal = document.getElementById('modal');
        modalContent = document.getElementById('modal-content');
        modalTitle = document.getElementById('modal-title');
        var modalClose = document.getElementById('modal-close');
        var modalBlackout = document.getElementById('modal-blackout');
        modalClose.addEventListener('click', onModalClose);
        modalBlackout.addEventListener('click', onModalClose);
        videoCards = document.getElementsByClassName('video-card');
        for (var i = 0, l = videoCards.length; i < l; ++i) {
            videoCards[i].dataset.id = i;
            videoCards[i].addEventListener('click', onCardClick);
        }
        var modalInside = document.getElementById('modal-inside');
        modal.addEventListener('click', onModalClose);
        modalInside.addEventListener('click', onClickInside);
        nextVideoButton = document.getElementById('next-video');
        prevVideoButton = document.getElementById('previous-video');
        nextVideoButton.addEventListener('click', onChangeVideo.bind(null, 1));
        prevVideoButton.addEventListener('click', onChangeVideo.bind(null, -1));
    }

    function onKeyDown(event) {
        if (modal && !modal.classList.contains('hidden') && event.key === 'Escape') {
            onModalClose();
        }
    }

    document.addEventListener('DOMContentLoaded', onLoad);
    document.addEventListener('keydown', onKeyDown);
})();
