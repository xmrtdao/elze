/* ═══════════════════════════════════════════════════════════════════════════
   Elze Contract Writer™ — Frontend Application
   © 2026 Cuttlefish Labs
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── API Configuration ── */
  const API_URL = '/api/v1/functions/lease-builder';
  const ANALYZER_URL = '/api/v1/functions/lease-analyzer';

  /* ── State ── */
  let templates = [];
  let clauseLibrary = [];
  let selectedTemplate = null;
  let selectedClauses = new Set();      // clause IDs that are toggled ON
  let customClauses = {};               // clauseId → custom text override
  let activeTab = 'builder';
  let lastBuiltDocument = '';
  let lastBuildData = null;
  let lastAnalysisReport = null;

  /* ── DOM Refs ── */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const els = {
    sidebar: $('#sidebar'),
    sidebarToggle: $('#sidebarToggle'),
    templateList: $('#templateList'),
    // Party inputs
    inpLandlord: $('#inpLandlord'),
    inpTenant: $('#inpTenant'),
    inpAddress: $('#inpAddress'),
    inpBuilding: $('#inpBuilding'),
    inpSF: $('#inpSF'),
    inpPremisesType: $('#inpPremisesType'),
    // Term inputs
    inpTermYears: $('#inpTermYears'),
    inpCommencement: $('#inpCommencement'),
    inpExpiration: $('#inpExpiration'),
    inpBaseRentPSF: $('#inpBaseRentPSF'),
    inpSecDepMonths: $('#inpSecDepMonths'),
    inpLateFeePct: $('#inpLateFeePct'),
    inpGraceDays: $('#inpGraceDays'),
    inpCAM: $('#inpCAM'),
    inpParking: $('#inpParking'),
    inpEscalation: $('#inpEscalation'),
    inpUse: $('#inpUse'),
    inpRenewal: $('#inpRenewal'),
    // Buttons
    btnBuild: $('#btnBuild'),
    btnPrecheck: $('#btnPrecheck'),
    btnExpandAll: $('#btnExpandAll'),
    btnCollapseAll: $('#btnCollapseAll'),
    btnSelectDefaults: $('#btnSelectDefaults'),
    btnDownloadTxt: $('#btnDownloadTxt'),
    btnDownloadMd: $('#btnDownloadMd'),
    btnDownloadJson: $('#btnDownloadJson'),
    btnAnalyzeLease: $('#btnAnalyzeLease'),
    btnRunPrecheck: $('#btnRunPrecheck'),
    // Content
    clauseCategories: $('#clauseCategories'),
    clauseCount: $('#clauseCount'),
    previewDocument: $('#previewDocument'),
    previewStatus: $('#previewStatus'),
    analysisResults: $('#analysisResults'),
    analysisBanner: $('#analysisBanner'),
    analysisFindings: $('#analysisFindings'),
    complianceSummary: $('#complianceSummary'),
    complianceWarnings: $('#complianceWarnings'),
    complianceStatus: $('#complianceStatus'),
    // Tabs
    tabNav: $('#tabNav'),
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     LOGIN GATE — API Key Authentication (Protects IP)
     ═══════════════════════════════════════════════════════════════════════════ */
  const loginGate = document.getElementById('loginGate');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const btnLogin = document.getElementById('btnLogin');
  const loginError = document.getElementById('loginError');

  const SESSION_KEY = 'elze_writer_auth_key';

  function checkSession() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      loginGate.classList.add('hidden');
      // We have a stored key — initialize the app
      initApp();
      return;
    }
    // Hide main app until authenticated
    document.body.style.overflow = 'hidden';
  }

  async function doLogin() {
    const key = apiKeyInput.value.trim();
    if (!key) { showLoginError('Please enter an API key.'); return; }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Validating…';
    loginError.style.display = 'none';

    try {
      // Validate by hitting the relay health endpoint
      const res = await fetch('/health', {
        headers: { 'x-api-key': key },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error('Invalid API key or relay unreachable.');
      const data = await res.json();
      if (data.status !== 'ok') throw new Error('Relay returned unexpected status.');

      // Valid — store in session and unlock
      sessionStorage.setItem(SESSION_KEY, key);
      loginGate.classList.add('hidden');
      document.body.style.overflow = '';
      initApp();
    } catch (err) {
      showLoginError(err.message || 'Authentication failed. Please check your API key.');
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<span class="btn-icon">🔐</span> Unlock Access';
    }
  }

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }

  btnLogin.addEventListener('click', doLogin);
  apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  /* ═══════════════════════════════════════════════════════════════════════════
     API HELPER
     ═══════════════════════════════════════════════════════════════════════════ */
  function getApiKey() {
    return sessionStorage.getItem(SESSION_KEY) || '';
  }

  async function apiCall(body) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function analyzerCall(body) {
    const res = await fetch(ANALYZER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════════════════════════════════════ */
  async function initApp() {
    try {
      // Fetch templates and clause library in parallel
      const [tmplRes, clauseRes] = await Promise.all([
        apiCall({ action: 'templates' }),
        apiCall({ action: 'clauses' }),
      ]);

      templates = tmplRes.templates || [];
      clauseLibrary = clauseRes.clauses || [];

      renderTemplates();
      renderClauses();
      updateClauseCount();

      // Auto-select the first template (commercial_office)
      if (templates.length > 0) {
        selectTemplate(templates[0].id);
      }
    } catch (err) {
      console.error('Init error:', err);
      els.templateList.innerHTML = `<div class="template-loading" style="color:var(--critical)">Failed to load: ${escapeHtml(err.message)}</div>`;
      els.clauseCategories.innerHTML = `<div class="clause-loading" style="color:var(--critical)">Failed to load clause library: ${escapeHtml(err.message)}</div>`;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     TEMPLATE SELECTOR
     ═══════════════════════════════════════════════════════════════════════════ */
  function renderTemplates() {
    els.templateList.innerHTML = templates.map(t => `
      <div class="template-card" data-template="${t.id}">
        <div class="template-name">${escapeHtml(t.name)}</div>
        <div class="template-desc">${escapeHtml(t.description)}</div>
        <div class="template-meta">${t.clauseCount} clauses · ${t.leaseType}</div>
      </div>
    `).join('');

    // Click handlers
    $$('.template-card').forEach(card => {
      card.addEventListener('click', () => selectTemplate(card.dataset.template));
    });
  }

  function selectTemplate(templateId) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;

    selectedTemplate = templateId;

    // Update active card styling
    $$('.template-card').forEach(c => {
      c.classList.toggle('active', c.dataset.template === templateId);
    });

    // Auto-populate form fields from template defaults
    const d = tmpl.defaults || {};
    if (d.permittedUse) els.inpUse.value = d.permittedUse;
    if (d.parkingSpaces != null) els.inpParking.value = d.parkingSpaces;
    if (d.proRataShare != null) els.inpCAM.value = d.proRataShare;
    if (d.leaseTermYears != null) els.inpTermYears.value = d.leaseTermYears;
    if (d.baseRentPSF != null) els.inpBaseRentPSF.value = d.baseRentPSF;
    if (d.securityDepositMonths != null) els.inpSecDepMonths.value = d.securityDepositMonths;

    // Set premises type from template if the field is empty
    const tmplFull = TEMPLATES_FULL[templateId];
    if (tmplFull && tmplFull.premisesType && !els.inpPremisesType.value) {
      els.inpPremisesType.value = tmplFull.premisesType;
    }

    // Set default clause selections from template
    selectedClauses = new Set(tmplFull ? tmplFull.defaultClauses : []);
    customClauses = {}; // Reset custom clause edits

    // Re-render clause library to reflect new selections
    renderClauses();
    updateClauseCount();

    // Run a compliance pre-check after template change
    debouncedPrecheck();
  }

  // We need the full template data (including defaultClauses & premisesType)
  // The API only returns a subset, so we fetch it from the 'templates' action
  // and reconstruct. Actually, the API returns defaults but not defaultClauses.
  // We'll maintain a local copy of the full template definitions for reference.
  // These must match the backend CLAUSE_LIBRARY and TEMPLATES.
  const TEMPLATES_FULL = {
    commercial_office: {
      premisesType: 'office',
      defaultClauses: ['parties', 'term', 'baseRent', 'securityDeposit', 'lateFee', 'cam', 'use', 'assignment', 'insurance', 'indemnification', 'landlordEntry', 'alterations', 'defaultRemedies', 'forceMajeure', 'parking', 'signage', 'quietEnjoyment', 'attorneysFees', 'governingLaw', 'entireAgreement', 'holdover', 'estoppel', 'notices', 'waiver', 'ADA', 'subordination'],
    },
    commercial_warehouse: {
      premisesType: 'warehouse and light industrial',
      defaultClauses: ['parties', 'term', 'baseRent', 'securityDeposit', 'lateFee', 'cam', 'use', 'assignment', 'insurance', 'indemnification', 'landlordEntry', 'alterations', 'defaultRemedies', 'forceMajeure', 'environmental', 'parking', 'signage', 'quietEnjoyment', 'attorneysFees', 'governingLaw', 'entireAgreement', 'holdover', 'estoppel', 'notices', 'snowRemoval', 'trashDisposal', 'ADA', 'subordination'],
    },
    commercial_retail: {
      premisesType: 'retail',
      defaultClauses: ['parties', 'term', 'baseRent', 'securityDeposit', 'lateFee', 'cam', 'use', 'assignment', 'insurance', 'indemnification', 'landlordEntry', 'alterations', 'defaultRemedies', 'forceMajeure', 'parking', 'signage', 'quietEnjoyment', 'attorneysFees', 'governingLaw', 'entireAgreement', 'holdover', 'estoppel', 'notices', 'waiver', 'ADA', 'subordination', 'rightOfFirstRefusal'],
    },
    triple_net: {
      premisesType: 'commercial',
      defaultClauses: ['parties', 'term', 'baseRent', 'securityDeposit', 'lateFee', 'use', 'assignment', 'insurance', 'indemnification', 'landlordEntry', 'alterations', 'defaultRemedies', 'forceMajeure', 'environmental', 'parking', 'signage', 'quietEnjoyment', 'attorneysFees', 'governingLaw', 'entireAgreement', 'holdover', 'estoppel', 'notices', 'waiver', 'ADA', 'subordination', 'rightOfFirstRefusal', 'renewalOption'],
    },
    ground_lease: {
      premisesType: 'land',
      defaultClauses: ['parties', 'term', 'baseRent', 'use', 'assignment', 'insurance', 'indemnification', 'defaultRemedies', 'forceMajeure', 'environmental', 'quietEnjoyment', 'attorneysFees', 'governingLaw', 'entireAgreement', 'holdover', 'estoppel', 'notices', 'waiver', 'subordination', 'renewalOption'],
    },
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CLAUSE LIBRARY RENDERING
     ═══════════════════════════════════════════════════════════════════════════ */
  const CATEGORY_META = {
    core:       { icon: '📋', label: 'Core Provisions' },
    financial:  { icon: '💰', label: 'Financial Terms' },
    operational: { icon: '⚙️', label: 'Operational Clauses' },
    legal:      { icon: '⚖️', label: 'Legal & Protective' },
  };

  function renderClauses() {
    // Group clauses by category
    const categories = {};
    for (const clause of clauseLibrary) {
      if (!categories[clause.category]) categories[clause.category] = [];
      categories[clause.category].push(clause);
    }

    // Render in canonical order: core, financial, operational, legal
    const order = ['core', 'financial', 'operational', 'legal'];
    let html = '';

    for (const cat of order) {
      const clauses = categories[cat];
      if (!clauses || clauses.length === 0) continue;

      const meta = CATEGORY_META[cat] || { icon: '📄', label: cat };
      html += `
        <div class="clause-category">
          <div class="clause-category-header">
            <span class="category-icon">${meta.icon}</span>
            <span>${meta.label}</span>
            <span class="category-count">${clauses.length} clauses</span>
          </div>
          <div class="clause-list">
            ${clauses.map(renderClauseItem).join('')}
          </div>
        </div>`;
    }

    els.clauseCategories.innerHTML = html;
    attachClauseEvents();
  }

  function renderClauseItem(clause) {
    const isEnabled = selectedClauses.has(clause.id);
    const isRequired = clause.required;
    const isExpanded = false; // All collapsed by default
    const hasCustom = customClauses[clause.id] !== undefined;

    const badges = [];
    if (isRequired) badges.push('<span class="clause-badge required">Required</span>');
    if (clause.statuteRef) badges.push(`<span class="clause-badge statute">§ ${escapeHtml(clause.statuteRef)}</span>`);

    return `
      <div class="clause-item ${isEnabled ? 'enabled' : 'disabled'} ${isRequired ? 'required' : ''} ${isExpanded ? 'expanded' : ''}" data-clause-id="${clause.id}">
        <div class="clause-header">
          <label class="clause-toggle">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} ${isRequired ? 'disabled' : ''} data-toggle="${clause.id}">
            <span class="clause-toggle-slider"></span>
          </label>
          <span class="clause-name">${escapeHtml(clause.name)}</span>
          <div class="clause-badges">
            ${badges.join('')}
            ${hasCustom ? '<span class="clause-badge" style="background:var(--accent-bg);color:var(--accent-light);border:1px solid var(--accent-border);">✏️ Edited</span>' : ''}
          </div>
          <span class="clause-expand">▶</span>
        </div>
        <div class="clause-editor">
          <div class="clause-editor-label">Clause Text (use {{variables}} for template substitution)</div>
          <textarea data-editor="${clause.id}" placeholder="${escapeHtml(clause.defaultText)}">${escapeHtml(customClauses[clause.id] || clause.defaultText)}</textarea>
          ${clause.compliance ? `<div class="clause-compliance">⚠️ Compliance: ${escapeHtml(JSON.stringify(clause.compliance))}</div>` : ''}
          <div class="clause-editor-hint">Template variables like {{landlordName}}, {{baseRentPSF}}, etc. will be replaced at build time.</div>
          <div class="clause-editor-actions">
            <button class="clause-reset-btn" data-reset="${clause.id}">↺ Reset to Default</button>
          </div>
        </div>
      </div>`;
  }

  function attachClauseEvents() {
    // Toggle events
    $$('[data-toggle]').forEach(input => {
      input.addEventListener('change', (e) => {
        const clauseId = e.target.dataset.toggle;
        if (e.target.checked) {
          selectedClauses.add(clauseId);
        } else {
          selectedClauses.delete(clauseId);
        }
        // Update item styling
        const item = e.target.closest('.clause-item');
        if (item) {
          item.classList.toggle('enabled', e.target.checked);
          item.classList.toggle('disabled', !e.target.checked);
        }
        updateClauseCount();
        debouncedPrecheck();
      });
    });

    // Expand/collapse events
    $$('.clause-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't toggle when clicking the switch or textarea
        if (e.target.closest('.clause-toggle')) return;
        const item = header.closest('.clause-item');
        if (item) item.classList.toggle('expanded');
      });
    });

    // Editor textarea — save custom text on input
    $$('[data-editor]').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const clauseId = e.target.dataset.editor;
        const clause = clauseLibrary.find(c => c.id === clauseId);
        // Only store as custom if different from default
        if (clause && e.target.value !== clause.defaultText) {
          customClauses[clauseId] = e.target.value;
        } else {
          delete customClauses[clauseId];
        }
        // Update "Edited" badge
        const item = e.target.closest('.clause-item');
        if (item) {
          let badge = item.querySelector('.clause-badge:last-of-type');
          const hasCustom = customClauses[clauseId] !== undefined;
          // Re-render badges area
          const badgesContainer = item.querySelector('.clause-badges');
          const existingEdited = badgesContainer.querySelector('[style*="Edited"]');
          if (hasCustom && !existingEdited) {
            const editedBadge = document.createElement('span');
            editedBadge.className = 'clause-badge';
            editedBadge.style.cssText = 'background:var(--accent-bg);color:var(--accent-light);border:1px solid var(--accent-border);';
            editedBadge.textContent = '✏️ Edited';
            badgesContainer.appendChild(editedBadge);
          } else if (!hasCustom && existingEdited) {
            existingEdited.remove();
          }
        }
      });
    });

    // Reset button
    $$('[data-reset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clauseId = e.target.dataset.reset;
        const clause = clauseLibrary.find(c => c.id === clauseId);
        if (!clause) return;
        delete customClauses[clauseId];
        const textarea = document.querySelector(`[data-editor="${clauseId}"]`);
        if (textarea) textarea.value = clause.defaultText;
        // Remove "Edited" badge
        const item = e.target.closest('.clause-item');
        if (item) {
          const editedBadge = item.querySelector('.clause-badges [style*="Edited"]');
          if (editedBadge) editedBadge.remove();
        }
      });
    });
  }

  function updateClauseCount() {
    const enabled = selectedClauses.size;
    const total = clauseLibrary.length;
    els.clauseCount.textContent = `${enabled}/${total} selected`;
  }

  /* ── Expand/Collapse All ── */
  els.btnExpandAll.addEventListener('click', () => {
    $$('.clause-item').forEach(item => item.classList.add('expanded'));
  });

  els.btnCollapseAll.addEventListener('click', () => {
    $$('.clause-item').forEach(item => item.classList.remove('expanded'));
  });

  /* ── Reset to Template Defaults ── */
  els.btnSelectDefaults.addEventListener('click', () => {
    if (!selectedTemplate) return;
    const tmpl = TEMPLATES_FULL[selectedTemplate];
    if (!tmpl) return;
    selectedClauses = new Set(tmpl.defaultClauses);
    customClauses = {};
    renderClauses();
    updateClauseCount();
    debouncedPrecheck();
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     LEASE DATA BUILDER — Collect form data into structured object
     ═══════════════════════════════════════════════════════════════════════════ */
  function collectLeaseData() {
    const parties = {
      landlordName: els.inpLandlord.value.trim() || '{{landlordName}}',
      tenantName: els.inpTenant.value.trim() || '{{tenantName}}',
      premisesAddress: els.inpAddress.value.trim() || '{{premisesAddress}}',
      buildingName: els.inpBuilding.value.trim() || '{{buildingName}}',
      premisesSF: parseFloat(els.inpSF.value) || 0,
      premisesType: els.inpPremisesType.value.trim() || 'commercial',
    };

    const terms = {
      leaseTermYears: parseInt(els.inpTermYears.value) || 5,
      commencementDate: els.inpCommencement.value || '',
      expirationDate: els.inpExpiration.value || '',
      baseRentPSF: parseFloat(els.inpBaseRentPSF.value) || 0,
      securityDepositMonths: parseFloat(els.inpSecDepMonths.value) || 2,
      lateFeePercent: parseFloat(els.inpLateFeePct.value) || 10,
      lateFeeGraceDays: parseInt(els.inpGraceDays.value) || 5,
      proRataShare: parseFloat(els.inpCAM.value) || 0,
      parkingSpaces: parseInt(els.inpParking.value) || 0,
      permittedUse: els.inpUse.value.trim() || 'general commercial purposes',
      escalationRate: parseFloat(els.inpEscalation.value) || 0,
      renewalOption: els.inpRenewal.value || '',
    };

    return {
      template: selectedTemplate || 'commercial_office',
      parties,
      terms,
      clauses: Array.from(selectedClauses),
      customClauses: { ...customClauses },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     COMPLIANCE PRE-CHECK (Debounced)
     ═══════════════════════════════════════════════════════════════════════════ */
  let precheckTimer = null;

  function debouncedPrecheck() {
    clearTimeout(precheckTimer);
    precheckTimer = setTimeout(runPrecheck, 600);
  }

  async function runPrecheck() {
    const leaseData = collectLeaseData();
    // The precheck endpoint takes leaseData with terms fields at top level
    // The backend's compliancePreCheck expects fields like securityDepositMonths,
    // lateFeePercent, etc. directly on the leaseData object
    const precheckData = {
      ...leaseData.terms,
      // Also pass some party info if needed
    };

    try {
      const result = await apiCall({ action: 'precheck', leaseData: precheckData });
      renderCompliance(result.warnings || []);
      return result.warnings || [];
    } catch (err) {
      console.error('Precheck error:', err);
      return [];
    }
  }

  function renderCompliance(warnings) {
    const count = warnings.length;
    if (count === 0) {
      els.complianceStatus.textContent = '✅ No warnings';
      els.complianceStatus.style.color = 'var(--low)';
      els.complianceSummary.innerHTML = `
        <div class="compliance-score pass">✓</div>
        <div class="compliance-grade a">Pass</div>
        <div class="compliance-summary-text">All checked terms comply with Virginia landlord-tenant statutes. No compliance warnings detected.</div>
      `;
      els.complianceWarnings.innerHTML = '<div class="empty-state">No compliance warnings. All terms pass VA statutory checks.</div>';
    } else {
      const criticals = warnings.filter(w => w.severity === 'critical').length;
      const highs = warnings.filter(w => w.severity === 'high').length;
      els.complianceStatus.textContent = `⚠️ ${count} warning${count !== 1 ? 's' : ''}`;
      els.complianceStatus.style.color = criticals > 0 ? 'var(--critical)' : highs > 0 ? 'var(--high)' : 'var(--medium)';

      const grade = criticals > 0 ? 'D' : highs > 0 ? 'C' : 'B';
      const gradeText = { A: 'Compliant', B: 'Mostly Compliant', C: 'Non-Compliant', D: 'Critical Violations' };
      els.complianceSummary.innerHTML = `
        <div class="compliance-score ${grade === 'A' ? 'pass' : grade === 'B' ? 'warn' : 'fail'}">${count}</div>
        <div class="compliance-grade ${grade.toLowerCase()}">Grade ${grade} — ${gradeText[grade]}</div>
        <div class="compliance-summary-text">${criticals} critical, ${highs} high, ${count - criticals - highs} medium severity warning${count !== 1 ? 's' : ''} detected. Review and fix before building the final document.</div>
      `;

      els.complianceWarnings.innerHTML = warnings.map(renderWarning).join('');
    }
  }

  function renderWarning(w) {
    const sevIcons = { critical: '🔴', high: '🟠', medium: '🟡' };
    return `
      <div class="warning-item ${w.severity}">
        <span class="warning-icon">${sevIcons[w.severity] || '⚠️'}</span>
        <div class="warning-body">
          <div class="warning-message">${escapeHtml(w.message)}</div>
          <div class="warning-meta">
            <span class="warning-sev-badge ${w.severity}">${w.severity.toUpperCase()}</span>
            <span class="warning-rule">${w.rule}</span>
            ${w.statute ? `<span>·</span><span class="warning-statute">VA § ${escapeHtml(w.statute)}</span>` : ''}
          </div>
          ${w.fix ? `<div class="warning-fix">${escapeHtml(w.fix)}</div>` : ''}
        </div>
      </div>`;
  }

  els.btnPrecheck.addEventListener('click', () => {
    els.complianceStatus.textContent = 'Checking…';
    runPrecheck();
  });

  els.btnRunPrecheck.addEventListener('click', () => {
    els.complianceStatus.textContent = 'Checking…';
    runPrecheck();
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     BUILD LEASE DOCUMENT
     ═══════════════════════════════════════════════════════════════════════════ */
  els.btnBuild.addEventListener('click', async () => {
    els.btnBuild.disabled = true;
    els.btnBuild.innerHTML = '<span class="btn-icon">⏳</span> Building…';
    els.previewStatus.textContent = 'Generating…';

    try {
      const leaseData = collectLeaseData();
      lastBuildData = leaseData;

      const result = await apiCall({
        action: 'build',
        leaseData,
        format: 'txt',
      });

      if (result.success) {
        lastBuiltDocument = result.document;
        // Render as white-page document
        const docTitle = result.document.split('\n')[0] || 'LEASE AGREEMENT';
        els.previewDocument.innerHTML = `
          <div class="preview-doc-inner">
            <div class="doc-title">${escapeHtml(docTitle.toUpperCase())}</div>
            <div class="doc-meta">Generated ${new Date(result.generatedAt).toLocaleString()} · Virginia-compliant</div>
            <div class="doc-body">${escapeHtml(result.document)}</div>
          </div>
        `;
        els.previewStatus.textContent = `Generated ${new Date(result.generatedAt).toLocaleString()}`;

        // If there are build-time warnings, show them
        if (result.warnings && result.warnings.length > 0) {
          renderCompliance(result.warnings);
        }

        // Auto-switch to preview tab
        switchTab('preview');
      } else {
        throw new Error(result.error || 'Build failed');
      }
    } catch (err) {
      els.previewStatus.textContent = 'Error';
      els.previewDocument.textContent = `Error building lease: ${err.message}`;
      console.error('Build error:', err);
    } finally {
      els.btnBuild.disabled = false;
      els.btnBuild.innerHTML = '<span class="btn-icon">📝</span> Build Lease Document';
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     EXPORT (Download as .txt, .md, .json)
     ═══════════════════════════════════════════════════════════════════════════ */
  els.btnDownloadTxt.addEventListener('click', () => {
    if (!lastBuiltDocument) { alert('Build a lease document first.'); return; }
    download('lease-document.txt', lastBuiltDocument, 'text/plain');
  });

  els.btnDownloadMd.addEventListener('click', () => {
    if (!lastBuiltDocument) { alert('Build a lease document first.'); return; }
    const md = convertToMarkdown(lastBuiltDocument);
    download('lease-document.md', md, 'text/markdown');
  });

  els.btnDownloadJson.addEventListener('click', () => {
    if (!lastBuildData) { alert('Build a lease document first.'); return; }
    // JSON export for round-trip with the analyzer
    const exportData = {
      document: lastBuiltDocument,
      leaseData: lastBuildData,
      exportedAt: new Date().toISOString(),
      tool: 'Elze Contract Writer™',
      version: '1.0.0',
    };
    download('lease-document.json', JSON.stringify(exportData, null, 2), 'application/json');
  });

  function convertToMarkdown(text) {
    // Simple conversion: split into sections, use markdown headers
    const lines = text.split('\n');
    let md = '';
    let inSection = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Section headers are numbered like "1. PARTIES AND PREMISES"
      if (/^\d+\.\s+[A-Z]/.test(trimmed)) {
        md += `\n## ${trimmed}\n\n`;
        inSection = true;
      } else if (trimmed === '='.repeat(60) || trimmed === '='.repeat(40)) {
        continue; // Skip separator lines
      } else if (trimmed && !inSection) {
        md += `# ${trimmed}\n\n`;
        inSection = true;
      } else if (trimmed) {
        md += `${line}\n`;
      } else {
        md += '\n';
      }
    }

    md += '\n---\n© 2026 Cuttlefish Labs. Generated by Elze Contract Writer™.\n';
    return md;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     ANALYZE THIS LEASE — Send built document to lease-analyzer
     ═══════════════════════════════════════════════════════════════════════════ */
  els.btnAnalyzeLease.addEventListener('click', async () => {
    if (!lastBuiltDocument) { alert('Build a lease document first.'); return; }

    els.btnAnalyzeLease.disabled = true;
    els.btnAnalyzeLease.innerHTML = '⏳ Analyzing…';
    els.analysisResults.style.display = 'block';
    els.analysisFindings.innerHTML = '<div class="empty-state">Running compliance analysis…</div>';

    try {
      const report = await analyzerCall({
        action: 'analyze',
        document: lastBuiltDocument,
        documentType: 'lease',
        documentName: 'Elze Writer Generated Lease',
      });

      lastAnalysisReport = report;
      renderAnalysisResults(report);
    } catch (err) {
      els.analysisBanner.style.display = 'flex';
      els.analysisBanner.className = 'compliance-banner grade-d';
      els.analysisBanner.textContent = `🚨 Analysis failed: ${err.message}`;
      els.analysisFindings.innerHTML = '';
      console.error('Analyze error:', err);
    } finally {
      els.btnAnalyzeLease.disabled = false;
      els.btnAnalyzeLease.innerHTML = '🔍 Analyze This Lease';
    }
  });

  function renderAnalysisResults(report) {
    if (!report || !report.success) {
      els.analysisBanner.style.display = 'flex';
      els.analysisBanner.className = 'compliance-banner grade-d';
      els.analysisBanner.textContent = '🚨 Analysis returned no results.';
      els.analysisFindings.innerHTML = '';
      return;
    }

    const { compliance, findings, summary, redlinedHtml, documentInfo } = report;
    const grade = compliance.grade || 'D';
    const docType = documentInfo?.detectedType || 'lease';
    const typeLabels = {
      commercial_lease: 'Commercial Lease', residential_lease: 'Residential Lease',
      service_contract: 'Service Contract', partnership_agreement: 'Partnership Agreement',
      articles_of_incorporation: 'Articles of Incorporation', independent_contractor: 'Independent Contractor Agreement',
      non_disclosure: 'Non-Disclosure Agreement', employment: 'Employment Agreement',
    };
    const typeLabel = typeLabels[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const gradeText = {
      A: '✅ Compliant — Minor issues only',
      B: '⚠️ Mostly Compliant — Some issues found',
      C: '⚠️ Non-Compliant — Multiple violations',
      D: '🚨 Critical Violations — Document is not compliant',
    };

    els.analysisBanner.style.display = 'flex';
    els.analysisBanner.className = `compliance-banner grade-${grade.toLowerCase()}`;
    els.analysisBanner.innerHTML = `<span>${gradeText[grade] || gradeText['D']}</span><span style="font-size:12px;font-weight:400;opacity:0.7;">${typeLabel} · Score: ${compliance.score}/100</span>`;

    // Show the full redline document
    const rawText = documentInfo?.rawText || '';
    const displayHtml = redlinedHtml || rawText;
    const docTitle = (rawText.split('\n')[0] || 'GENERATED LEASE').toUpperCase();

    els.analysisFindings.innerHTML = `
      <div class="redline-doc" style="margin-top:1rem;">
        <div class="redline-doc-title">${docTitle}</div>
        <div class="redline-doc-meta">Compliance Grade: ${grade} · Score: ${compliance.score}/100 · ${findings.length} findings · ${new Date().toLocaleDateString()}</div>
        <div class="doc-full-text">${displayHtml}</div>
      </div>
      ${findings.length > 0 ? `
        <div class="section-header" style="margin-top:2rem;">📋 All Findings</div>
        <div class="finding-list">${findings.map(renderFinding).join('')}</div>
      ` : ''}
    `;
  }

  function renderFinding(f) {
    const sevIcons = { critical: '🔴', high: '🟠', medium: '🟡' };
    const sevLabels = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM' };
    return `
      <div class="finding-card ${f.severity}">
        <div class="finding-header">
          <span class="finding-sev-badge ${f.severity}">${sevIcons[f.severity] || '⚠️'} ${sevLabels[f.severity] || f.severity.toUpperCase()}</span>
          <span class="finding-title">${escapeHtml(f.title)}</span>
          <span class="finding-id">${escapeHtml(f.id || '')}</span>
        </div>
        <div class="finding-desc">${escapeHtml(f.finding || '')}</div>
        ${f.citation ? `<div class="finding-cite" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-tertiary);background:var(--bg-elevated);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;border-left:2px solid var(--accent-border);margin:0.5rem 0;white-space:pre-wrap;word-break:break-word;">"${escapeHtml(f.citation)}"</div>` : ''}
        <div class="finding-statute">
          <span>⚖️</span>
          <span class="finding-statute-code">VA § ${escapeHtml(f.statute || '')}</span>
          ${f.statuteText ? `<span>—</span><span>${escapeHtml(f.statuteText)}</span>` : ''}
        </div>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     TAB NAVIGATION
     ═══════════════════════════════════════════════════════════════════════════ */
  els.tabNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  function switchTab(tab) {
    activeTab = tab;
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-content').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));

    // If switching to compliance tab, run precheck
    if (tab === 'compliance') {
      runPrecheck();
    }

    // If switching to preview tab and we have a built document, keep it
    // If no document built yet, show a prompt
    if (tab === 'preview' && !lastBuiltDocument) {
      els.previewDocument.textContent = 'Click "Build Lease Document" in the sidebar to generate a preview.';
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     FORM INPUT — Debounced pre-check on term changes
     ═══════════════════════════════════════════════════════════════════════════ */
  // Attach input listeners to all term inputs for live pre-check
  const termInputIds = [
    'inpTermYears', 'inpCommencement', 'inpExpiration', 'inpBaseRentPSF',
    'inpSecDepMonths', 'inpLateFeePct', 'inpGraceDays', 'inpCAM',
    'inpParking', 'inpEscalation', 'inpUse', 'inpRenewal',
    'inpLandlord', 'inpTenant', 'inpAddress', 'inpBuilding', 'inpSF', 'inpPremisesType'
  ];

  termInputIds.forEach(id => {
    const el = els[id];
    if (el) {
      el.addEventListener('input', debouncedPrecheck);
      el.addEventListener('change', debouncedPrecheck);
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════════════════════════ */
  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Sidebar Toggle (mobile) ── */
  els.sidebarToggle.addEventListener('click', () => {
    els.sidebar.classList.toggle('mobile-open');
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════════════════════ */
  checkSession();

})();