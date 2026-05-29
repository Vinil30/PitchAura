let currentModal = null;
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    initializeBusinessDashboard();
});

function initializeBusinessDashboard() {
    console.log('Initializing business dashboard...');
    
    // Setup navigation first
    setupNavigation();
    
    // Load initial section
    loadActiveSection();
    
    // Setup other event listeners
    const refreshBtn = document.getElementById('refresh-proposals');
    const categoryFilter = document.getElementById('category-filter');
    const newProposalBtn = document.getElementById('new-proposal-btn');
    const logoutBtn = document.querySelector('.login-btn');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshSubmissions);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', loadSubmissions);
    }
    
    if (newProposalBtn) {
        newProposalBtn.addEventListener('click', showNewProposalRequestModal);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Setup modal events
    setupModalEvents();
    
    console.log('Dashboard initialization complete');
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show target section
            const targetSection = this.getAttribute('data-section');
            const targetElement = document.getElementById(`${targetSection}-section`);
            
            if (targetElement) {
                targetElement.classList.add('active');
                
                // Load section data
                loadSectionData(targetSection);
            } else {
                console.error(`Target section not found: ${targetSection}-section`);
            }
        });
    });
    
    console.log('Navigation setup complete. Found', navItems.length, 'nav items');
}

function loadActiveSection() {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
        const targetSection = activeNav.getAttribute('data-section');
        loadSectionData(targetSection);
    }
}

function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'proposals':
            loadProposalRequests();
            break;
        case 'preferences':
            loadPreferences();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// ==================== DASHBOARD SECTION ====================

async function loadDashboard() {
    await loadSubmissions();
    await loadDashboardStats();
}

async function loadSubmissions() {
    const container = document.getElementById('proposals-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading submissions...</p>
        </div>
    `;
    
    try {
        const category = document.getElementById('category-filter').value;
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        
        const response = await fetch(`/api/submissions?${params.toString()}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            renderSubmissions(data.submissions);
        } else {
            container.innerHTML = `
                <div class="error-state">
                    <p>Error loading submissions: ${data.msg}</p>
                    <button class="btn btn-secondary" onclick="loadSubmissions()">Try Again</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Error loading submissions. Please try again.</p>
                <button class="btn btn-secondary" onclick="loadSubmissions()">Try Again</button>
            </div>
        `;
    }
}

function renderSubmissions(submissions) {
    const container = document.getElementById('proposals-container');
    if (!container) return;
    
    if (submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Submissions Yet</h3>
                <p>Share a proposal request from the Proposals tab to start receiving submissions from service providers.</p>
                <button class="btn btn-primary" onclick="selectDashboardSection('proposals')">
                    Open Proposals
                </button>
            </div>
        `;
        return;
    }
    
    const recentSubmissions = submissions.slice(0, 3);
    
    container.innerHTML = recentSubmissions.map(submission => `
        <div class="proposal-card" data-submission-id="${submission._id}">
            <div class="proposal-header">
                <div>
                    <h3 class="proposal-title">${escapeHtml(submission.title || 'Untitled Submission')}</h3>
                    <p class="proposal-category">${escapeHtml(submission.category || 'Uncategorized')}</p>
                </div>
                <div class="proposal-match ${getMatchClass(submission.match_score)}">
                    ${getMatchIcon(submission.match_score)}
                    ${submission.match_score}% Match
                </div>
            </div>
            <p class="proposal-summary">${escapeHtml(submission.description || 'No description available.')}</p>
            <div class="proposal-meta">
                <span class="proposal-budget">Budget: ${escapeHtml(submission.budget_range || 'Not specified')}</span>
                <span class="proposal-date">${new Date(submission.created_at).toLocaleDateString()}</span>
            </div>
            <div class="proposal-actions">
                <button class="btn btn-primary view-details-btn" data-submission-id="${submission._id}">View Details</button>
                <button class="btn btn-outline decline-btn" data-submission-id="${submission._id}">Decline</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners for submissions
    container.addEventListener('click', function(e) {
        const viewBtn = e.target.closest('.view-details-btn');
        const declineBtn = e.target.closest('.decline-btn');
        
        if (viewBtn) {
            const submissionId = viewBtn.getAttribute('data-submission-id');
            viewSubmission(submissionId);
        } else if (declineBtn) {
            const submissionId = declineBtn.getAttribute('data-submission-id');
            declineSubmission(submissionId);
        }
    });
}

async function loadDashboardStats() {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;
    
    try {
        const response = await fetch('/api/analytics/business');
        const data = await response.json();
        
        if (data.status === 'success') {
            renderDashboardStats(data.analytics);
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function renderDashboardStats(analytics) {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;
    
    const safeAnalytics = {
        total_requests: analytics?.total_requests || 0,
        active_requests: analytics?.active_requests || 0,
        total_submissions: analytics?.total_submissions || 0,
        high_match_submissions: analytics?.high_match_submissions || 0,
        pending_review: analytics?.pending_review || 0,
        avg_match_rate: analytics?.avg_match_rate || 0,
        review_rate: analytics?.review_rate || 0
    };
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.total_requests}</div>
            <div class="stat-label">Proposal Requests</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.total_submissions}</div>
            <div class="stat-label">Total Submissions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.pending_review}</div>
            <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.avg_match_rate}%</div>
            <div class="stat-label">Avg. Match Rate</div>
        </div>
    `;

    renderDashboardPipeline(safeAnalytics);
    renderDashboardActions(safeAnalytics);
}

function renderDashboardPipeline(analytics) {
    const container = document.getElementById('intake-pipeline');
    if (!container) return;

    const reviewed = Math.max(analytics.total_submissions - analytics.pending_review, 0);
    const items = [
        { label: 'New Intake', value: analytics.total_submissions, detail: 'All received submissions' },
        { label: 'Needs Review', value: analytics.pending_review, detail: 'Awaiting your decision' },
        { label: 'High Fit', value: analytics.high_match_submissions, detail: '80% match and above' },
        { label: 'Reviewed', value: reviewed, detail: 'Processed or declined' }
    ];

    container.innerHTML = items.map(item => `
        <div class="pipeline-step">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
            <small>${item.detail}</small>
        </div>
    `).join('');
}

function renderDashboardActions(analytics) {
    const container = document.getElementById('dashboard-actions');
    if (!container) return;

    const actions = [
        {
            title: analytics.pending_review ? `${analytics.pending_review} submissions need review` : 'Submission queue is clear',
            detail: analytics.pending_review ? 'Open the latest submissions and respond to strongest matches.' : 'New intake will appear here as soon as providers submit.'
        },
        {
            title: analytics.active_requests ? `${analytics.active_requests} active request${analytics.active_requests === 1 ? '' : 's'}` : 'Create your first active request',
            detail: analytics.active_requests ? 'Keep the best-performing request live and retire stale ones.' : 'Use Proposals to create a focused request for providers.'
        },
        {
            title: `${analytics.avg_match_rate}% average fit score`,
            detail: analytics.avg_match_rate >= 80 ? 'Your matching preferences are producing tight results.' : 'Tune preferences to lift match quality.'
        }
    ];

    container.innerHTML = actions.map(action => `
        <div class="action-item">
            <strong>${escapeHtml(action.title)}</strong>
            <span>${escapeHtml(action.detail)}</span>
        </div>
    `).join('');
}

// ==================== PROPOSALS SECTION ====================

async function loadProposalRequests() {
    const container = document.getElementById('all-proposals-container');
    if (!container) return;
    
    try {
        const response = await fetch('/api/proposal-requests');
        const data = await response.json();
        
        if (data.status === 'success') {
            renderProposalRequests(data.proposal_requests);
        } else {
            container.innerHTML = '<p>Error loading proposal requests</p>';
        }
    } catch (error) {
        console.error('Error loading proposal requests:', error);
        container.innerHTML = '<p>Error loading proposal requests</p>';
    }
}

function renderProposalRequests(proposalRequests) {
    const container = document.getElementById('all-proposals-container');
    if (!container) return;
    
    closeCurrentModal();
    
    if (proposalRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Proposal Requests</h3>
                <p>Create your first proposal request to start receiving submissions from service providers.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
                    <button class="btn btn-primary" onclick="showNewProposalRequestModal()">
                        Create Proposal Request
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = proposalRequests.map(request => `
        <div class="proposal-request-card" data-request-id="${request._id}">
            <div class="proposal-header">
                <div>
                    <h3 class="proposal-title">${escapeHtml(request.title || 'Untitled Request')}</h3>
                    <p class="proposal-category">${escapeHtml(request.category || 'Uncategorized')}</p>
                </div>
                <div class="proposal-status status-${request.status || 'active'}">
                    ${escapeHtml(request.status || 'Active')}
                </div>
            </div>
            <p class="proposal-summary">${escapeHtml(request.description || 'No description available.')}</p>
            <div class="proposal-meta">
                <span class="proposal-budget">Budget: ${escapeHtml(request.budget_range || 'Not specified')}</span>
                <span class="proposal-submissions">${request.submission_count || 0} Submissions</span>
                <span class="proposal-date">Created: ${new Date(request.created_at).toLocaleDateString()}</span>
            </div>
            <div class="proposal-actions">
                <button class="btn btn-primary view-submissions-btn" data-request-id="${request._id}">
                    View Submissions (${request.submission_count || 0})
                </button>
                <button class="btn btn-outline copy-proposal-link-btn" data-share-link="${escapeHtml(request.share_link || '')}">Share Link</button>
                <button class="btn btn-outline edit-request-btn" data-request-id="${request._id}">Edit</button>
                <button class="btn btn-outline delete-request-btn" data-request-id="${request._id}">Delete</button>
            </div>
            <div class="proposal-share-panel">
                <input type="text" class="share-input proposal-share-input" value="${escapeHtml(request.share_link || '')}" readonly>
                <div class="proposal-share-options">
                    <button type="button" class="share-option proposal-share-option" data-platform="facebook" data-share-link="${escapeHtml(request.share_link || '')}">Facebook</button>
                    <button type="button" class="share-option proposal-share-option" data-platform="linkedin" data-share-link="${escapeHtml(request.share_link || '')}">LinkedIn</button>
                    <button type="button" class="share-option proposal-share-option" data-platform="twitter" data-share-link="${escapeHtml(request.share_link || '')}">Twitter</button>
                    <button type="button" class="share-option proposal-share-option" data-platform="email" data-share-link="${escapeHtml(request.share_link || '')}">Email</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners for proposal requests
    container.addEventListener('click', function(e) {
        const viewSubmissionsBtn = e.target.closest('.view-submissions-btn');
        const copyShareBtn = e.target.closest('.copy-proposal-link-btn');
        const shareOption = e.target.closest('.proposal-share-option');
        const editBtn = e.target.closest('.edit-request-btn');
        const deleteBtn = e.target.closest('.delete-request-btn');
        
        if (viewSubmissionsBtn) {
            const requestId = viewSubmissionsBtn.getAttribute('data-request-id');
            viewSubmissionsForRequest(requestId);
        } else if (copyShareBtn) {
            copyShareLink(copyShareBtn.getAttribute('data-share-link'), copyShareBtn);
        } else if (shareOption) {
            openShareTarget(shareOption.getAttribute('data-platform'), shareOption.getAttribute('data-share-link'));
        } else if (editBtn) {
            const requestId = editBtn.getAttribute('data-request-id');
            editProposalRequest(requestId);
        } else if (deleteBtn) {
            const requestId = deleteBtn.getAttribute('data-request-id');
            deleteProposalRequest(requestId);
        }
    });
}

// ==================== PREFERENCES SECTION ====================

async function loadPreferences() {
    const container = document.getElementById('preferences-form');
    if (!container) return;
    
    try {
        const response = await fetch('/api/preferences');
        const data = await response.json();
        
        if (data.status === 'success') {
            renderPreferencesForm(data.preferences);
        } else {
            container.innerHTML = '<p>Error loading preferences</p>';
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
        container.innerHTML = '<p>Error loading preferences</p>';
    }
}

function renderPreferencesForm(preferences) {
    const container = document.getElementById('preferences-form');
    if (!container) return;
    
    const safePrefs = {
        categories: preferences.categories || [],
        budget_min: preferences.budget_min || 5000,
        budget_max: preferences.budget_max || 50000,
        technologies: preferences.technologies || [],
        project_scope: preferences.project_scope || '',
        match_threshold: preferences.match_threshold || 80
    };
    
    const choice = (name, value, selected) => `
        <label class="choice-card">
            <input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''}>
            <span>${escapeHtml(value)}</span>
        </label>
    `;

    container.innerHTML = `
        <form id="business-preferences-form" class="preference-shell">
            <div class="preference-panel">
                <div class="preference-block">
                    <h3>Proposal categories</h3>
                    <p>Choose the work streams BidMind should prioritize for incoming submissions.</p>
                    <div class="choice-grid">
                        ${['Web Development', 'Marketing Services', 'Staffing', 'Partnerships', 'Investment'].map(category => choice('categories', category, safePrefs.categories.includes(category))).join('')}
                    </div>
                </div>

                <div class="preference-block">
                    <h3>Budget range</h3>
                    <p>Set the commercial range that makes a proposal worth reviewing.</p>
                    <div class="form-row">
                        <input type="number" class="form-input" name="budget_min" placeholder="Minimum" value="${safePrefs.budget_min}" required>
                        <input type="number" class="form-input" name="budget_max" placeholder="Maximum" value="${safePrefs.budget_max}" required>
                    </div>
                </div>

                <div class="preference-block">
                    <h3>Preferred technologies</h3>
                    <p>Select the stacks and delivery skills that should boost match quality.</p>
                    <div class="choice-grid">
                        ${['React', 'Node.js', 'Python/Django', 'PHP/Laravel', 'Vue.js', 'Angular', 'Java/Spring', '.NET'].map(tech => choice('technologies', tech, safePrefs.technologies.includes(tech))).join('')}
                    </div>
                </div>

                <div class="preference-block">
                    <h3>Project scope</h3>
                    <p>Describe the signals, outcomes, or constraints your team cares about most.</p>
                    <textarea class="form-textarea" name="project_scope" placeholder="Example: B2B SaaS implementation, clear delivery plan, measurable growth impact, monthly reporting.">${escapeHtml(safePrefs.project_scope)}</textarea>
                </div>
            </div>

            <aside class="preference-sidecar">
                <h3>Matching strictness</h3>
                <p>Use this threshold to control how selective your intake should be.</p>
                <div class="threshold-readout">
                    <strong id="threshold-value">${safePrefs.match_threshold}%</strong>
                    <span>minimum fit</span>
                </div>
                <input type="range" name="match_threshold" min="50" max="100" value="${safePrefs.match_threshold}" class="threshold-slider">
                <p>Higher values surface fewer, stronger proposals. Lower values keep discovery wider.</p>
                <button type="submit" class="btn btn-primary save-preferences">Save Preferences</button>
                <button type="button" class="btn btn-outline share-after-save" onclick="selectDashboardSection('proposals')">Open Proposal Links</button>
            </aside>
        </form>
    `;
    
    const form = document.getElementById('business-preferences-form');
    form.addEventListener('submit', handlePreferenceSubmit);
    
    const slider = document.querySelector('.threshold-slider');
    const valueDisplay = document.getElementById('threshold-value');
    slider.addEventListener('input', function() {
        valueDisplay.textContent = this.value + '%';
    });
}

async function handlePreferenceSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const preferences = {
        categories: formData.getAll('categories'),
        budget_min: parseInt(formData.get('budget_min')),
        budget_max: parseInt(formData.get('budget_max')),
        technologies: formData.getAll('technologies'),
        project_scope: formData.get('project_scope'),
        match_threshold: parseInt(formData.get('match_threshold'))
    };
    
    if (preferences.categories.length === 0) {
        showNotification('Please select at least one category', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Preferences saved successfully. Proposal share links will use these rules.', 'success');
        } else {
            showNotification('Error saving preferences: ' + data.msg, 'error');
        }
    } catch (error) {
        console.error('Error saving preferences:', error);
        showNotification('Error saving preferences. Please try again.', 'error');
    }
}

// ==================== ANALYTICS SECTION ====================

async function loadAnalytics() {
    const container = document.getElementById('analytics-container');
    if (!container) return;
    
    try {
        const response = await fetch('/api/analytics/business');
        const data = await response.json();
        
        if (data.status === 'success') {
            renderAnalytics(data.analytics);
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function renderAnalytics(analytics) {
    const container = document.getElementById('analytics-container');
    if (!container) return;
    
    const safeAnalytics = {
        total_requests: analytics?.total_requests || 0,
        total_submissions: analytics?.total_submissions || 0,
        high_match_submissions: analytics?.high_match_submissions || 0,
        pending_review: analytics?.pending_review || 0,
        avg_match_rate: analytics?.avg_match_rate || 0,
        active_requests: analytics?.active_requests || 0,
        review_rate: analytics?.review_rate || 0,
        category_breakdown: analytics?.category_breakdown || [],
        match_distribution: analytics?.match_distribution || []
    };
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.total_submissions}</div>
            <div class="stat-label">Total Submissions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.high_match_submissions}</div>
            <div class="stat-label">High Fit Submissions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.active_requests}</div>
            <div class="stat-label">Active Requests</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${safeAnalytics.avg_match_rate}%</div>
            <div class="stat-label">Avg. Match Rate</div>
        </div>
    `;

    renderAnalyticsChart('category-chart', safeAnalytics.category_breakdown, 'No categories yet');
    renderAnalyticsChart('match-chart', safeAnalytics.match_distribution, 'No match scores yet');
}

function renderAnalyticsChart(elementId, rows, emptyText) {
    const chart = document.getElementById(elementId);
    if (!chart) return;

    const cleanedRows = (rows || []).filter(row => Number(row.count) > 0);
    if (cleanedRows.length === 0) {
        chart.innerHTML = `<div class="chart-empty">${emptyText}</div>`;
        return;
    }

    const max = Math.max(...cleanedRows.map(row => Number(row.count)));
    chart.innerHTML = `
        <div class="bar-chart">
            ${cleanedRows.map(row => {
                const count = Number(row.count);
                const width = Math.max((count / max) * 100, 8);
                return `
                    <div class="bar-row">
                        <div class="bar-row-label">
                            <span>${escapeHtml(row.label || 'Unknown')}</span>
                            <strong>${count}</strong>
                        </div>
                        <div class="bar-track"><i style="width:${width}%"></i></div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==================== MODAL FUNCTIONALITY ====================

function setupModalEvents() {
    const modal = document.getElementById('new-proposal-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-proposal');
    const form = document.getElementById('new-proposal-form');
    
    [closeBtn, cancelBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    
    form.addEventListener('submit', handleNewProposalRequest);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showNewProposalRequestModal() {
    const modal = document.getElementById('new-proposal-modal');
    modal.style.display = 'block';
}

async function handleNewProposalRequest(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const budgetMin = formData.get('budget_min');
    const budgetMax = formData.get('budget_max');
    
    const proposalRequestData = {
        title: formData.get('title'),
        category: formData.get('category'),
        description: formData.get('description'),
        budget_range: `$${budgetMin} - $${budgetMax}`,
        timeline: formData.get('timeline'),
        requirements: formData.get('description')
    };
    
    try {
        const response = await fetch('/api/proposal-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(proposalRequestData)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Proposal request created successfully!', 'success');
            document.getElementById('new-proposal-modal').style.display = 'none';
            event.target.reset();
            loadProposalRequests();
            loadDashboard();
        } else {
            showNotification('Error creating proposal request: ' + data.msg, 'error');
        }
    } catch (error) {
        console.error('Error creating proposal request:', error);
        showNotification('Error creating proposal request. Please try again.', 'error');
    }
}

// ==================== SUBMISSION DETAILS MODAL ====================

async function viewSubmission(submissionId) {
    await showSubmissionDetails(submissionId);
}

async function showSubmissionDetails(submissionId) {
    closeCurrentModal();
    
    try {
        showLoadingModal();
        
        const response = await fetch(`/api/submissions/${submissionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        closeCurrentModal();

        if (data.status === 'success') {
            renderSubmissionDetailsModal(data.submission);
        } else {
            showNotification('Error loading submission details: ' + data.msg, 'error');
        }
    } catch (error) {
        console.error('Error in showSubmissionDetails:', error);
        closeCurrentModal();
        showNotification('Error loading submission details. Please try again.', 'error');
    }
}

function renderSubmissionDetailsModal(submission) {
    closeCurrentModal();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'submission-details-modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const createdDate = new Date(submission.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const updatedDate = new Date(submission.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    modal.innerHTML = `
        <div class="modal-content large-modal" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 style="margin: 0;">Submission Details</h3>
                <button class="modal-close" id="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="submission-details">
                    <div class="details-header">
                        <div class="details-title-section">
                            <h2 class="submission-title-large">${escapeHtml(submission.title || 'Untitled Submission')}</h2>
                            <div class="details-meta">
                                <span class="submission-category-badge">${escapeHtml(submission.category || 'Uncategorized')}</span>
                                <span class="submission-status-badge status-${submission.status || 'pending'}">${escapeHtml(submission.status || 'Pending')}</span>
                                <div class="submission-match-large ${getMatchClass(submission.match_score)}">
                                    ${getMatchIcon(submission.match_score)}
                                    ${submission.match_score}% Match
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div class="details-column">
                            <div class="details-section">
                                <h4>Submission Information</h4>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Submitted By:</label>
                                        <span>${escapeHtml(submission.submitter_name || 'Not specified')}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Email:</label>
                                        <span>${escapeHtml(submission.submitter_email || 'Not specified')}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Company:</label>
                                        <span>${escapeHtml(submission.company_name || 'Not specified')}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Budget:</label>
                                        <span>${escapeHtml(submission.budget_range || submission.budget || 'Not specified')}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Timeline:</label>
                                        <span>${escapeHtml(submission.timeline || 'Not specified')}</span>
                                    </div>
                                </div>
                            </div>

                            ${submission.technologies && submission.technologies.length > 0 ? `
                            <div class="details-section">
                                <h4>Technology Stack</h4>
                                <div class="tech-tags">
                                    ${submission.technologies.map(tech => `
                                        <span class="tech-tag">${escapeHtml(tech)}</span>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}

                            ${submission.portfolio_url ? `
                            <div class="details-section">
                                <h4>Portfolio</h4>
                                <a href="${escapeHtml(submission.portfolio_url)}" target="_blank" class="portfolio-link">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    View Portfolio
                                </a>
                            </div>
                            ` : ''}
                        </div>

                        <div class="details-column">
                            <div class="details-section">
                                <h4>Project Description</h4>
                                <div class="description-content">
                                    ${submission.description ? `
                                        <p>${escapeHtml(submission.description)}</p>
                                    ` : `
                                        <p class="no-content">No description provided.</p>
                                    `}
                                </div>
                            </div>

                            ${submission.experience ? `
                            <div class="details-section">
                                <h4>Relevant Experience</h4>
                                <div class="experience-content">
                                    <p>${escapeHtml(submission.experience)}</p>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="details-section full-width">
                        <h4>Submission Timeline</h4>
                        <div class="timeline-info">
                            <div class="timeline-item">
                                <label>Submitted:</label>
                                <span>${createdDate}</span>
                            </div>
                            <div class="timeline-item">
                                <label>Last Updated:</label>
                                <span>${updatedDate}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="modal-actions">
                    ${submission.status !== 'declined' ? `
                    <button class="btn btn-outline" id="decline-submission-btn">
                        Decline Submission
                    </button>
                    ` : ''}
                    <button class="btn btn-primary" id="close-modal-btn">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    currentModal = modal;
    
    setTimeout(() => {
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeCurrentModal);
        }
        
        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeCurrentModal);
        }
        
        const declineBtn = document.getElementById('decline-submission-btn');
        if (declineBtn) {
            declineBtn.addEventListener('click', () => {
                declineSubmissionFromDetails(submission._id);
            });
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeCurrentModal();
            }
        });
    }, 0);
    
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeCurrentModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
    modal._escapeHandler = escapeHandler;
}

// ==================== PROPOSAL REQUEST FUNCTIONS ====================

async function viewSubmissionsForRequest(requestId) {
    try {
        const response = await fetch(`/api/proposal-requests/${requestId}/submissions`);
        const data = await response.json();
        
        if (data.status === 'success') {
            renderRequestSubmissionsModal(requestId, data.submissions);
        } else {
            showNotification('Error loading submissions: ' + data.msg, 'error');
        }
    } catch (error) {
        console.error('Error loading submissions for request:', error);
        showNotification('Error loading submissions. Please try again.', 'error');
    }
}

function renderRequestSubmissionsModal(requestId, submissions) {
    closeCurrentModal();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'request-submissions-modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    modal.innerHTML = `
        <div class="modal-content large-modal" style="max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 style="margin: 0;">Submissions for Request</h3>
                <button class="modal-close" id="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="submissions-list">
                    ${submissions.length === 0 ? `
                        <div class="empty-state">
                            <p>No submissions yet for this request.</p>
                        </div>
                    ` : `
                        ${submissions.map(submission => `
                            <div class="submission-item" data-submission-id="${submission._id}">
                                <div class="submission-header">
                                    <h4>${escapeHtml(submission.title || 'Untitled Submission')}</h4>
                                    <div class="submission-match ${getMatchClass(submission.match_score)}">
                                        ${submission.match_score}% Match
                                    </div>
                                </div>
                                <p class="submission-summary">${escapeHtml(submission.description || 'No description available.')}</p>
                                <div class="submission-meta">
                                    <span>Budget: ${escapeHtml(submission.budget_range || 'Not specified')}</span>
                                    <span>Submitted: ${new Date(submission.created_at).toLocaleDateString()}</span>
                                </div>
                                <div class="submission-actions">
                                    <button class="btn btn-primary view-submission-btn" data-submission-id="${submission._id}">View Details</button>
                                    <button class="btn btn-outline decline-submission-btn" data-submission-id="${submission._id}">Decline</button>
                                </div>
                            </div>
                        `).join('')}
                    `}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="close-modal-btn">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    currentModal = modal;
    
    setTimeout(() => {
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeCurrentModal);
        }
        
        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeCurrentModal);
        }
        
        // Add event listeners for submission actions within the modal
        const viewButtons = modal.querySelectorAll('.view-submission-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const submissionId = this.getAttribute('data-submission-id');
                closeCurrentModal();
                viewSubmission(submissionId);
            });
        });
        
        const declineButtons = modal.querySelectorAll('.decline-submission-btn');
        declineButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const submissionId = this.getAttribute('data-submission-id');
                declineSubmission(submissionId);
            });
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeCurrentModal();
            }
        });
    }, 0);
    
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeCurrentModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
    modal._escapeHandler = escapeHandler;
}

async function editProposalRequest(requestId) {
    // Implementation for editing proposal request
    showNotification('Edit functionality coming soon!', 'info');
}

async function deleteProposalRequest(requestId) {
    if (confirm('Are you sure you want to delete this proposal request? This action cannot be undone.')) {
        try {
            const response = await fetch(`/api/proposal-requests/${requestId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('Proposal request deleted successfully', 'success');
                loadProposalRequests();
                loadDashboard();
            } else {
                showNotification('Error deleting proposal request: ' + data.msg, 'error');
            }
        } catch (error) {
            console.error('Error deleting proposal request:', error);
            showNotification('Error deleting proposal request. Please try again.', 'error');
        }
    }
}

// ==================== ACTION FUNCTIONS ====================

async function declineSubmission(submissionId) {
    if (confirm('Are you sure you want to decline this submission?')) {
        try {
            const response = await fetch(`/api/submissions/${submissionId}/decline`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('Submission declined successfully', 'success');
                loadSubmissions();
                loadDashboard();
            } else {
                showNotification('Error declining submission: ' + data.msg, 'error');
            }
        } catch (error) {
            console.error('Error declining submission:', error);
            showNotification('Error declining submission. Please try again.', 'error');
        }
    }
}

async function declineSubmissionFromDetails(submissionId) {
    if (confirm('Are you sure you want to decline this submission?')) {
        try {
            const response = await fetch(`/api/submissions/${submissionId}/decline`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('Submission declined successfully', 'success');
                closeCurrentModal();
                loadSubmissions();
                loadDashboard();
            } else {
                showNotification('Error declining submission: ' + data.msg, 'error');
            }
        } catch (error) {
            console.error('Error declining submission:', error);
            showNotification('Error declining submission. Please try again.', 'error');
        }
    }
}

function refreshSubmissions() {
    const refreshBtn = document.getElementById('refresh-proposals');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `
        <div class="loading-spinner small"></div>
        Refreshing...
    `;
    
    loadSubmissions().finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23 4V10H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M1 20V14H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.51 9C4.01717 7.56678 4.87913 6.2854 6.01547 5.27542C7.1518 4.26543 8.52547 3.55976 10.0083 3.22426C11.4911 2.88875 13.0348 2.93434 14.4952 3.35677C15.9556 3.77921 17.2853 4.56471 18.36 5.64L23 10M1 14L5.64 18.36C6.71475 19.4353 8.04437 20.2208 9.50481 20.6432C10.9652 21.0657 12.5089 21.1113 13.9917 20.7757C15.4745 20.4402 16.8482 19.7346 17.9845 18.7246C19.1209 17.7146 19.9828 16.4332 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh Submissions
        `;
    });
}

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        window.location.href = '/logout';
    }
}

function selectDashboardSection(section) {
    const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navItem) {
        navItem.click();
    } else {
        loadSectionData(section);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function showLoadingModal() {
    closeCurrentModal();
    
    const modal = document.createElement('div');
    modal.id = 'loading-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 300px; text-align: center;">
            <div class="modal-body" style="padding: 2rem;">
                <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
                <p style="margin: 0; color: #6b7280;">Loading details...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    currentModal = modal;
    
    modal.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

function closeCurrentModal() {
    // Close any custom modals
    if (currentModal) {
        if (currentModal._escapeHandler) {
            document.removeEventListener('keydown', currentModal._escapeHandler);
        }
        
        if (currentModal.parentNode) {
            document.body.removeChild(currentModal);
        }
        currentModal = null;
    }
    
    // Close predefined modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal.style.display === 'block' || modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
    
    // Specifically close the new proposal modal
    const newProposalModal = document.getElementById('new-proposal-modal');
    if (newProposalModal) {
        newProposalModal.style.display = 'none';
    }
}

// ==================== HELPER FUNCTIONS ====================

function getMatchClass(score) {
    if (score >= 80) return 'match-high';
    if (score >= 70) return 'match-medium';
    return 'match-low';
}

function getMatchIcon(score) {
    if (score >= 80) {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 16V12" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8H12.01" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.background = '#059669';
    } else {
        notification.style.background = '#dc2626';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

async function copyShareLink(shareLink, button) {
    if (!shareLink || !shareLink.startsWith('http')) {
        showNotification('Create or refresh this proposal request to generate a share link', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(shareLink);
    } catch (error) {
        const tempInput = document.createElement('input');
        tempInput.value = shareLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
    }

    const previousText = button ? button.textContent : '';
    if (button) button.textContent = 'Copied';
    setTimeout(() => {
        if (button) button.textContent = previousText || 'Share Link';
    }, 2000);
    showNotification('Link copied to clipboard!', 'success');
}

function openShareTarget(platform, shareLink) {
    if (!shareLink || !shareLink.startsWith('http')) {
        showNotification('Create or refresh this proposal request to generate a share link', 'error');
        return;
    }

    const shareText = 'Submit your proposal on BidMind';
    let shareUrl = '';
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareLink)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=Proposal Request&body=${encodeURIComponent(shareText + ': ' + shareLink)}`;
            break;
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
}
