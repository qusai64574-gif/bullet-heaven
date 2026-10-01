/* ==========================================================================
   screens/assistant.js — the ChatGPT-style surface.
   Blank canvas, one composer, streaming replies, conversation history in a
   sidebar grouped by recency, follow-up actions, jump-to-latest pill.
   The reasoning is local (Assistant module) and reads the student's own data.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.U;
  const M = global.Models;
  const Store = global.Store;
  const UI = global.UI;

  const SUGGESTION_CHIPS = [
    { icon: 'clock', text: 'What’s due today?' },
    { icon: 'alert', text: 'What’s overdue?' },
    { icon: 'clipboard', text: 'When is my next exam?' },
    { icon: 'sparkles', text: 'Plan my study week' },
    { icon: 'trending', text: 'How am I doing?' },
    { icon: 'target', text: 'What should I focus on?' },
  ];

  function assistant() {
    const root = U.el('div', { class: 'screen' });
    let conv = null;
    const state = { streaming: false, stopStream: null, pinned: true, draft: '' };

    if (Store.getSetting('assistantHistory', true)) {
      const existing = Assistant.conversations();
      conv = existing.length ? existing[0] : Assistant.newConversation();
    } else {
      conv = { id: null, title: 'New chat', messages: [] };
    }

    /* ------------------------------ Structure ---------------------------- */
    const scroll = U.el('div', { class: 'chat__scroll' });
    const inner = U.el('div', { class: 'chat__inner' });
    scroll.appendChild(inner);

    const input = U.el('textarea', {
      class: 'composer__input',
      rows: 1,
      placeholder: 'Ask about your planner…',
      'aria-label': 'Message the planner assistant',
    });
    const sendBtn = U.el('button', {
      class: 'composer__send',
      type: 'button',
      'aria-label': 'Send message',
      disabled: true,
      onclick: () => {
        if (state.streaming) stop();
        else send(input.value);
      },
    }, [U.icon('send', 17)]);

    const composer = U.el('div', { class: 'composer' }, [
      U.el('div', { class: 'composer__box' }, [input, sendBtn]),
      U.el('div', { class: 'composer__hint', text: 'Reads your planner on this device. Nothing is uploaded.' }),
    ]);

    const chat = U.el('div', { class: 'chat' }, [scroll, composer]);
    root.appendChild(chat);

    const jumpPill = U.el('button', {
      class: 'jump-pill',
      type: 'button',
      style: { display: 'none' },
      onclick: () => scrollToBottom(true),
    }, [U.icon('arrowDown', 14), U.el('span', { text: 'Jump to latest' })]);

    /* ------------------------------- Input ------------------------------- */
    input.addEventListener('input', () => {
      state.draft = input.value;
      autoGrow();
      sendBtn.disabled = !input.value.trim() && !state.streaming;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isTouchPrimary()) {
        e.preventDefault();
        if (!state.streaming) send(input.value);
      }
    });
    input.addEventListener('focus', () => {
      setTimeout(() => scrollToBottom(true), 260);
    });

    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.min(140, input.scrollHeight) + 'px';
    }

    function isTouchPrimary() {
      try {
        return global.matchMedia('(hover: none)').matches;
      } catch (e) {
        return false;
      }
    }

    /* ------------------------------- Scroll ------------------------------ */
    scroll.addEventListener('scroll', () => {
      const dist = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
      state.pinned = dist < 60;
      jumpPill.style.display = state.pinned ? 'none' : '';
    });

    function scrollToBottom(force) {
      if (!force && !state.pinned) return;
      scroll.scrollTop = scroll.scrollHeight;
      state.pinned = true;
      jumpPill.style.display = 'none';
    }

    /* ------------------------------ Messages ----------------------------- */
    function messageNode(msg, opts) {
      const o = opts || {};
      const isUser = msg.role === 'user';
      const node = U.el('div', { class: 'msg ' + (isUser ? 'msg--user' : 'msg--assistant') });

      if (!isUser) {
        node.appendChild(U.el('div', { class: 'msg__avatar' }, [U.icon('sparkles', 15)]));
      }

      const col = U.el('div', { class: 'msg__col' });
      const bubble = U.el('div', { class: 'msg__bubble' });
      bubble.innerHTML = o.raw ? msg.text : format(msg.text);
      col.appendChild(bubble);

      if (!isUser && msg.payload && !o.streaming) {
        const card = payloadCard(msg.payload);
        if (card) col.appendChild(card);
      }

      if (!isUser && !o.streaming) {
        col.appendChild(
          U.el('div', { class: 'msg__actions' }, [
            U.el('button', {
              class: 'msg__action',
              type: 'button',
              onclick: () => copyText(msg.text),
            }, [U.icon('copy', 13), U.el('span', { text: 'Copy' })]),
            U.el('button', {
              class: 'msg__action',
              type: 'button',
              onclick: () => {
                const prev = lastUserText();
                if (prev) send(prev, { skipUser: true });
              },
            }, [U.icon('refresh', 13), U.el('span', { text: 'Retry' })]),
            msg.payload && msg.payload.kind === 'items' && msg.payload.rows && msg.payload.rows.length
              ? U.el('button', {
                  class: 'msg__action',
                  type: 'button',
                  onclick: () => {
                    const row = msg.payload.rows[0];
                    if (row.route) global.Router.go(row.route);
                  },
                }, [U.icon('arrowRight', 13), U.el('span', { text: 'Open first' })])
              : null,
          ])
        );
      }

      node.appendChild(col);
      return node;
    }

    function payloadCard(payload) {
      if (!payload) return null;
      if (payload.kind === 'navigate') {
        setTimeout(() => global.Router.go(payload.route), 420);
        return null;
      }
      const card = U.el('div', { class: 'chat__card' });
      if (payload.title) card.appendChild(U.el('div', { class: 'chat__card-head', text: payload.title }));

      if (payload.kind === 'stats') {
        const s = payload.stats;
        card.appendChild(
          U.el('div', { class: 'chat__card-row', style: { gap: '14px' } }, [
            statBit(s.done + '/' + s.total, 'completed'),
            statBit(s.rate + '%', 'rate'),
            statBit(String(s.overdue), 'overdue'),
            statBit(String(s.streak), 'streak'),
          ])
        );
        return card;
      }

      (payload.rows || []).forEach((row) => {
        const isPrompt = !!row.prompt;
        card.appendChild(
          U.el('button', {
            class: 'chat__card-row',
            type: 'button',
            style: { width: '100%', textAlign: 'left' },
            onclick: () => {
              if (isPrompt) send(row.prompt);
              else if (row.route) global.Router.go(row.route);
            },
          }, [
            row.color ? U.el('span', { class: 'subject-dot', style: { background: row.color } }) : null,
            U.el('div', { class: 'grow col', style: { minWidth: 0 } }, [
              U.el('div', { class: 'truncate' + (row.done ? ' text-tertiary' : ''), style: { fontWeight: '500', textDecoration: row.done ? 'line-through' : 'none' }, text: row.title }),
              row.meta ? U.el('div', { class: 'text-tertiary truncate', style: { fontSize: 'var(--fs-caption)' }, text: row.meta }) : null,
            ]),
            row.overdue ? U.el('span', { class: 'badge badge--overdue', text: 'Overdue' }) : null,
            U.el('span', { class: 'list__chev' }, [U.icon(isPrompt ? 'arrowRight' : 'chevronRight', 15)]),
          ])
        );
      });

      if (payload.more) {
        card.appendChild(U.el('div', { class: 'chat__card-row text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: '+' + payload.more + ' more — open the list to see everything' }));
      }
      return card;
    }

    function statBit(value, label) {
      return U.el('div', { class: 'col', style: { flex: '1', minWidth: 0 } }, [
        U.el('div', { style: { fontWeight: '600', fontVariantNumeric: 'tabular-nums' }, text: value }),
        U.el('div', { class: 'text-tertiary', style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }, text: label }),
      ]);
    }

    /** Very small markdown subset: **bold**, *italic*, bullets, line breaks. */
    function format(text) {
      const escaped = U.escapeHtml(text || '');
      return escaped
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
          UI.toast('Copied.');
          return;
        }
        throw new Error('no clipboard');
      } catch (e) {
        UI.toast('Copying is not available here.');
      }
    }

    function lastUserText() {
      const msgs = (conv && conv.messages) || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') return msgs[i].text;
      }
      return '';
    }

    /* ------------------------------- Render ------------------------------ */
    function renderAll() {
      U.clear(inner);
      const msgs = (conv && conv.messages) || [];
      if (!msgs.length) {
        inner.appendChild(emptyState());
      } else {
        msgs.forEach((m) => inner.appendChild(messageNode(m)));
      }
      inner.appendChild(jumpPill);
      requestAnimationFrame(() => scrollToBottom(true));
    }

    function emptyState() {
      const wrap = U.el('div', { class: 'chat__empty' });
      wrap.appendChild(
        U.el('div', {
          style: { width: '52px', height: '52px', borderRadius: 'var(--r-lg)', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' },
        }, [U.icon('sparkles', 26)])
      );
      wrap.appendChild(U.el('div', { class: 'chat__empty-title', text: U.greeting(Store.profile().name) }));
      wrap.appendChild(U.el('div', { class: 'chat__empty-sub', text: 'Ask me about your homework, exams and deadlines — or tell me what to add.' }));
      const chips = U.el('div', { class: 'chat__chips' });
      Assistant.suggestions().forEach((s) => {
        chips.appendChild(
          U.el('button', {
            class: 'chat__chip',
            type: 'button',
            onclick: () => send(s.text),
          }, [U.icon(s.icon || 'sparkles', 15), U.el('span', { class: 'grow', text: s.text })])
        );
      });
      wrap.appendChild(chips);
      return wrap;
    }

    /* -------------------------------- Send ------------------------------- */
    function send(text, opts) {
      const o = opts || {};
      const clean = String(text || '').trim();
      if (!clean || state.streaming) return;

      if (!o.skipUser) {
        const userMsg = { role: 'user', text: clean, ts: Date.now() };
        pushMessage(userMsg);
        inner.querySelector('.chat__empty') && renderAll();
        if (inner.querySelector('.chat__empty')) renderAll();
        else inner.insertBefore(messageNode(userMsg, { raw: true }), jumpPill);
        state.pinned = true;
        requestAnimationFrame(() => scrollToBottom(true));
      }

      input.value = '';
      state.draft = '';
      autoGrow();
      sendBtn.disabled = true;

      // Typing indicator
      const status = U.el('div', { class: 'chat__status' }, [
        U.el('span', { class: 'typing' }, [U.el('i'), U.el('i'), U.el('i')]),
        U.el('span', { text: 'Reading your planner…' }),
      ]);
      const pending = U.el('div', { class: 'msg msg--assistant' }, [
        U.el('div', { class: 'msg__avatar' }, [U.icon('sparkles', 15)]),
        U.el('div', { class: 'msg__col' }, [status]),
      ]);
      inner.insertBefore(pending, jumpPill);
      requestAnimationFrame(() => scrollToBottom(true));

      // Reason over the real data (synchronously, it is all local).
      let answer;
      try {
        answer = Assistant.reply(clean, (conv && conv.messages) || []);
      } catch (e) {
        console.error('[assistant] reply failed', e);
        answer = { text: 'Something went wrong while reading your planner. Your data is safe — try again.', payload: null };
      }

      const delay = 220 + Math.min(420, clean.length * 6);
      setTimeout(() => {
        pending.remove();
        const msg = { role: 'assistant', text: answer.text, payload: answer.payload, ts: Date.now() };
        const node = U.el('div', { class: 'msg msg--assistant is-fresh' });
        node.appendChild(U.el('div', { class: 'msg__avatar' }, [U.icon('sparkles', 15)]));
        const col = U.el('div', { class: 'msg__col' });
        const bubble = U.el('div', { class: 'msg__bubble' });
        const typing = U.el('span', { class: 'typing' }, [U.el('i'), U.el('i'), U.el('i')]);
        bubble.appendChild(typing);
        col.appendChild(bubble);
        node.appendChild(col);
        inner.insertBefore(node, jumpPill);
        scrollToBottom();

        state.streaming = true;
        sendBtn.classList.add('is-stop');
        sendBtn.innerHTML = '';
        sendBtn.appendChild(U.icon('stop', 15));
        sendBtn.disabled = false;
        sendBtn.setAttribute('aria-label', 'Stop generating');

        let i = 0;
        const full = answer.text || '';
        const chunk = Math.max(4, Math.ceil(full.length / 40));
        let finished = false;

        const timer = setInterval(() => {
          i += chunk;
          if (i >= full.length) {
            i = full.length;
          }
          bubble.textContent = full.slice(0, i);
          scrollToBottom();
          if (i >= full.length) {
            clearInterval(timer);
            finish(full, answer, msg, col, bubble, node);
          }
        }, 16);

        state.stopStream = () => {
          if (finished) return;
          finished = true;
          clearInterval(timer);
          bubble.textContent = full.slice(0, Math.max(i, 0)) + ' …';
          endStream();
        };
      }, delay);
    }

    function finish(full, answer, msg, col, bubble, node) {
      bubble.innerHTML = format(full);
      if (answer.payload) {
        const card = payloadCard(answer.payload);
        if (card) col.appendChild(card);
      }
      col.appendChild(
        U.el('div', { class: 'msg__actions' }, [
          U.el('button', { class: 'msg__action', type: 'button', onclick: () => copyText(full) }, [U.icon('copy', 13), U.el('span', { text: 'Copy' })]),
          U.el('button', {
            class: 'msg__action',
            type: 'button',
            onclick: () => {
              const prev = lastUserText();
              if (prev) send(prev, { skipUser: true });
            },
          }, [U.icon('refresh', 13), U.el('span', { text: 'Retry' })]),
        ])
      );
      setTimeout(() => node.classList.remove('is-fresh'), 1200);
      pushMessage(msg);
      endStream();
      scrollToBottom();
    }

    function endStream() {
      state.streaming = false;
      state.stopStream = null;
      sendBtn.classList.remove('is-stop');
      sendBtn.innerHTML = '';
      sendBtn.appendChild(U.icon('send', 17));
      sendBtn.setAttribute('aria-label', 'Send message');
      sendBtn.disabled = !input.value.trim();
    }

    function stop() {
      if (state.stopStream) state.stopStream();
    }

    function pushMessage(msg) {
      if (!conv) return;
      if (!conv.messages) conv.messages = [];
      conv.messages.push(msg);
      if (Store.getSetting('assistantHistory', true) && conv.id) {
        const saved = Assistant.appendMessage(conv.id, msg);
        if (saved) conv = saved;
      }
    }

    /* ------------------------------ Sidebar ------------------------------ */
    function openSidebar() {
      const backdrop = U.el('div', { class: 'sheet-backdrop' });
      const side = U.el('aside', { class: 'sidebar', role: 'dialog', 'aria-label': 'Conversations' });

      const groups = Assistant.groupConversations();
      const listWrap = U.el('div', { class: 'sidebar__scroll' });

      const newBtn = U.el('button', {
        class: 'sidebar__item',
        type: 'button',
        onclick: () => {
          close();
          startNewChat();
        },
      }, [U.el('span', { class: 'list__icon', style: { width: '26px', height: '26px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' } }, [U.icon('plus', 15)]), U.el('span', { class: 'grow', text: 'New chat' })]);

      side.appendChild(
        U.el('div', { class: 'sidebar__head' }, [
          U.el('div', { class: 'grow row', style: { gap: '10px' } }, [
            UI.avatar(Store.profile().name, null, 'avatar--sm'),
            U.el('div', { class: 'col', style: { minWidth: 0 } }, [
              U.el('div', { style: { fontWeight: '600', fontSize: 'var(--fs-callout)' }, text: Store.profile().name || 'Student' }),
              U.el('div', { class: 'text-tertiary', style: { fontSize: 'var(--fs-caption)' }, text: 'Study Planner' }),
            ]),
          ]),
          U.el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => close() }, [U.icon('x', 20)]),
        ])
      );
      side.appendChild(U.el('div', { style: { padding: '0 12px 6px' } }, [newBtn]));

      Object.keys(groups).forEach((label) => {
        if (!groups[label].length) return;
        listWrap.appendChild(U.el('div', { class: 'sidebar__group', text: label }));
        groups[label].forEach((c) => {
          const item = U.el('div', { class: 'row', style: { gap: '2px' } }, [
            U.el('button', {
              class: 'sidebar__item' + (conv && conv.id === c.id ? ' is-active' : ''),
              type: 'button',
              style: { flex: '1', minWidth: 0 },
              onclick: () => {
                close();
                conv = c;
                renderAll();
              },
            }, [U.icon('message', 15), U.el('span', { class: 'grow', text: c.title || 'New chat' })]),
            U.el('button', {
              class: 'icon-btn icon-btn--sm',
              type: 'button',
              'aria-label': 'Delete conversation',
              onclick: async (e) => {
                e.stopPropagation();
                const ok = await UI.confirm({ title: 'Delete this chat?', message: c.title || 'New chat', confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                Store.remove('conversations', c.id);
                close();
                if (conv && conv.id === c.id) startNewChat();
                else openSidebar();
              },
            }, [U.icon('trash', 15)]),
          ]);
          listWrap.appendChild(item);
        });
      });

      if (!Assistant.conversations().length) {
        listWrap.appendChild(
          U.el('div', { class: 'text-tertiary', style: { padding: '16px 12px', fontSize: 'var(--fs-footnote)', lineHeight: '1.5' }, text: 'Your conversations appear here, newest first. Nothing leaves this device.' })
        );
      }

      side.appendChild(listWrap);

      side.appendChild(
        U.el('div', { style: { padding: '10px 12px calc(14px + var(--safe-bottom))', borderTop: '1px solid var(--border-subtle)' } }, [
          U.el('button', {
            class: 'sidebar__item',
            type: 'button',
            onclick: () => {
              close();
              global.Router.go('/settings');
            },
          }, [U.icon('settings', 16), U.el('span', { class: 'grow', text: 'Settings' })]),
          U.el('button', {
            class: 'sidebar__item',
            type: 'button',
            onclick: async () => {
              const ok = await UI.confirm({ title: 'Clear all chat history?', message: 'Your planner items are not affected.', confirmLabel: 'Clear', danger: true });
              if (!ok) return;
              Assistant.clearHistory();
              close();
              startNewChat();
              UI.toast('Chat history cleared.');
            },
          }, [U.icon('trash', 16), U.el('span', { class: 'grow', text: 'Clear chat history' })]),
        ])
      );

      document.body.appendChild(backdrop);
      document.body.appendChild(side);
      backdrop.addEventListener('click', close);

      function onKey(e) {
        if (e.key === 'Escape') close();
      }
      document.addEventListener('keydown', onKey);

      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey);
        side.classList.add('is-closing');
        backdrop.classList.add('is-closing');
        setTimeout(() => {
          side.remove();
          backdrop.remove();
        }, 200);
      }
    }

    function startNewChat() {
      if (state.streaming) stop();
      if (Store.getSetting('assistantHistory', true)) {
        conv = Assistant.newConversation();
      } else {
        conv = { id: null, title: 'New chat', messages: [] };
      }
      renderAll();
      setTimeout(() => input.focus(), 120);
    }

    renderAll();

    return {
      node: root,
      title: 'Assistant',
      subtitle: '',
      back: true,
      flush: true,
      actions: [
        { icon: 'menu', label: 'Conversations', onClick: openSidebar },
        { icon: 'plus', label: 'New chat', onClick: startNewChat },
      ],
      cleanup() {
        if (state.stopStream) state.stopStream();
      },
    };
  }

  global.Screens = global.Screens || {};
  global.Screens.assistant = assistant;
})(window);
