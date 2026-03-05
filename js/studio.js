/**
 * SolveCivil Answer Studio - Knowledge Studio Module
 * @version 1.0.0
 */

const Studio = {
  currentTab: 'answers', // 'answers' or 'theory'

  init() {
    console.log('Knowledge Studio Initializing...');
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // 탭 전환 이벤트
    document.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    // UI 업데이트
    document.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // 섹션 표시 전환
    document.getElementById('studio-answers-view').classList.toggle('hidden', tab !== 'answers');
    document.getElementById('studio-theory-view').classList.toggle('hidden', tab !== 'theory');
    
    this.render();
  },

  /**
   * 공통 저장/수정 로직
   * @param {string} type 'questions' | 'theories'
   */
  async saveEntry(type) {
    const data = window.App.State;
    const formId = type === 'questions' ? 'answerForm' : 'theoryForm';
    const form = document.getElementById(formId);
    
    if (!form) return;

    const formData = new FormData(form);
    const entry = Object.fromEntries(formData.entries());
    
    // 태그 처리
    if (entry.tags) {
      entry.tags = entry.tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const editingIndex = document.getElementById(`editing-${type}-index`).value;
    
    if (editingIndex !== "") {
      data[type][parseInt(editingIndex)] = { ...data[type][parseInt(editingIndex)], ...entry };
      window.setDataStatus(`${type === 'questions' ? '답안' : '이론'} 수정 완료`, 'success');
    } else {
      entry.id = type === 'questions' ? `Q${data[type].length + 1}` : `TH-${String(data[type].length + 1).padStart(3, '0')}`;
      data[type].push(entry);
      window.setDataStatus(`${type === 'questions' ? '답안' : '이론'} 추가 완료`, 'success');
    }

    this.resetForm(type);
    window.syncJsonAndRender(data);
  },

  editEntry(type, index) {
    const item = window.App.State[type][index];
    if (!item) return;

    const prefix = type === 'questions' ? 'q' : 't';
    // 폼 필드 채우기 (HTML 구조에 맞춰 ID 매칭 필요)
    for (const key in item) {
      const el = document.getElementById(`studio-${prefix}-${key}`);
      if (el) {
        if (el.type === 'checkbox') el.checked = !!item[key];
        else if (Array.isArray(item[key])) el.value = item[key].join(', ');
        else el.value = item[key];
      }
    }

    document.getElementById(`editing-${type}-index`).value = index;
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = '수정 저장';
    
    window.setDataStatus(`${item.id} 수정 모드`, 'info');
  },

  deleteEntry(type, index) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    const removed = window.App.State[type].splice(index, 1)[0];
    window.syncJsonAndRender(window.App.State, `${removed.id} 삭제 완료`);
  },

  resetForm(type) {
    const formId = type === 'questions' ? 'answerForm' : 'theoryForm';
    const form = document.getElementById(formId);
    if (form) form.reset();
    
    document.getElementById(`editing-${type}-index`).value = "";
    const btn = document.getElementById(`studio-${type}-submit-btn`);
    if (btn) btn.textContent = type === 'questions' ? '답안 추가' : '이론 추가';
  },

  render() {
    // 필터링 및 리스트 렌더링 로직 (기본 renderAnswerData 호출 등)
    window.renderAnswerData(window.App.State);
  }
};

window.Studio = Studio;
