(function () {
    function showToast(message) {
        let toast = document.querySelector('.pa-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'pa-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('is-visible');
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(function () {
            toast.classList.remove('is-visible');
        }, 2600);
    }

    function improveNavigation() {
        document.querySelectorAll('.dashboard-nav .nav-item').forEach(function (item) {
            item.setAttribute('role', 'button');
            item.setAttribute('aria-current', item.classList.contains('active') ? 'page' : 'false');
            item.addEventListener('click', function () {
                document.querySelectorAll('.dashboard-nav .nav-item').forEach(function (nav) {
                    nav.setAttribute('aria-current', 'false');
                });
                item.setAttribute('aria-current', 'page');
            });
        });
    }

    function improveForms() {
        document.querySelectorAll('form').forEach(function (form) {
            form.addEventListener('submit', function () {
                const submit = form.querySelector('[type="submit"], .btn-submit');
                if (!submit || submit.dataset.paBusy === 'true') return;
                submit.dataset.paBusy = 'true';
                submit.dataset.paLabel = submit.textContent.trim();
                submit.classList.add('is-busy');
                submit.textContent = 'Working...';

                window.setTimeout(function () {
                    if (!submit.isConnected) return;
                    submit.dataset.paBusy = 'false';
                    submit.classList.remove('is-busy');
                    if (submit.dataset.paLabel) submit.textContent = submit.dataset.paLabel;
                }, 3500);
            });
        });
    }

    function improveCopyFeedback() {
        document.addEventListener('click', function (event) {
            const target = event.target.closest('#copy-link-btn, [data-copy-feedback]');
            if (!target) return;
            window.setTimeout(function () {
                showToast('Link copied. Ready to share.');
            }, 120);
        });
    }

    function completeEmptyContainers() {
        const messages = {
            'portfolio-container': 'Portfolio decisions will collect here after you mark opportunities as a fit.',
            'summaries-container': 'Maybe decisions will create concise summaries here for later review.',
            'analytics-container': 'Analytics will fill in as proposals and pitch decisions move through the platform.',
            'all-proposals-container': 'Proposal requests you create will appear here.',
            'investor-matches-container': 'Investor matches will appear once pitches are reviewed.'
        };

        window.setTimeout(function () {
            Object.keys(messages).forEach(function (id) {
                const element = document.getElementById(id);
                if (!element || element.children.length > 0 || element.textContent.trim()) return;
                element.innerHTML = '<div class="empty-state"><p>' + messages[id] + '</p></div>';
            });
        }, 900);
    }

    document.addEventListener('DOMContentLoaded', function () {
        improveNavigation();
        improveForms();
        improveCopyFeedback();
        completeEmptyContainers();
    });
})();
