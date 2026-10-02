import { createInitialSnapshot } from './domain/fixtures.mjs';
import { assessReservation, approveReservation, suggestAlternatives } from './domain/engine.mjs';
import { loadCatalogue } from './content.mjs';

const el = id => document.getElementById(id);
let baseline = createInitialSnapshot();
let snapshot = structuredClone(baseline);
let currentProposal = null;
let requestSequence = 0;
const icons = {'storm-umbrella':'☂️','whisper-atlas':'🗺️','moonseed-tin':'🌱','yesterday-camera':'📷','comet-kettle':'🫖','bookmark-moth':'🦋'};
const clone = value => structuredClone(value);
const findObject = id => snapshot.objects.find(object => object.id === id);
const findEra = id => snapshot.eras.find(era => era.id === id);
const textNode = (tag, text, className) => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
};
function setOptions(select, items, selected) {
  select.replaceChildren(...items.map(({value, label}) => {
    const option = document.createElement('option');
    option.value = value; option.textContent = label;
    return option;
  }));
  if (items.some(item => item.value === selected)) select.value = selected;
}
function renderCatalogue() {
  const filter = el('era-filter').value;
  const grid = el('catalogue-grid');
  grid.replaceChildren();
  snapshot.objects.forEach((object, index) => {
    if (filter !== 'all' && !object.availableEraIds.includes(filter)) return;
    const card = textNode('article', '', 'object-card');
    const visual = textNode('div', '', 'object-visual'); visual.dataset.tone = String(index % 6);
    const symbol = textNode('span', icons[object.id] || '✦', 'object-symbol'); symbol.setAttribute('aria-hidden', 'true');
    visual.append(textNode('span', `BT / ${String(index + 1).padStart(3,'0')}`, 'object-number'), symbol, textNode('span', object.restorationStatus === 'ready' ? 'Ready to travel' : 'In restoration', 'condition'));
    const content = textNode('div', '', 'object-content');
    content.append(textNode('h3', object.name), textNode('p', object.description));
    const tags = textNode('div', '', 'era-tags');
    object.availableEraIds.forEach(id => tags.append(textNode('span', findEra(id)?.name || id)));
    const borrow = textNode('button', 'Request this object ↗', 'borrow-button'); borrow.type='button';
    borrow.addEventListener('click', () => {
      el('object-select').value = object.id;
      const eraId = filter !== 'all' ? filter : object.availableEraIds[0];
      if (findEra(eraId)) { el('era-select').value = eraId; resetDates(); }
      clearAssessment(); el('desk').scrollIntoView({behavior:'smooth'}); el('object-select').focus({preventScroll:true});
    });
    content.append(tags, borrow); card.append(visual, content); grid.append(card);
  });
  if (!grid.childElementCount) grid.append(textNode('p','No objects are able to visit this era.','empty'));
}
function resetDates() {
  const era = findEra(el('era-select').value);
  if (!era) return;
  const start = era.startDate;
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  const end = date.toISOString().slice(0,10);
  el('start-date').value = start;
  el('end-date').value = end < era.endDate ? end : era.endDate;
  el('start-date').min = era.startDate; el('start-date').max = era.endDate;
  el('end-date').min = era.startDate; el('end-date').max = era.endDate;
}
function initialiseSelects() {
  setOptions(el('era-filter'), [{value:'all',label:'Every era'}, ...snapshot.eras.map(era => ({value:era.id,label:era.name}))], 'all');
  setOptions(el('era-select'), snapshot.eras.map(era => ({value:era.id,label:era.name})), snapshot.eras[0]?.id);
  setOptions(el('object-select'), snapshot.objects.map(object => ({value:object.id,label:object.name})), snapshot.objects[0]?.id);
  resetDates();
}
function clearAssessment() {
  currentProposal = null;
  const panel = el('assessment'); panel.className = 'assessment';
  const p = textNode('p','A quiet timeline is a happy timeline. Start with a borrowing request.','assessment-idle');
  panel.replaceChildren(p);
}
function proposalFromForm() {
  return {id:`local-request-${++requestSequence}`,objectId:el('object-select').value,eraId:el('era-select').value,borrower:el('borrower-name').value.trim() || 'Curious traveller',startDate:el('start-date').value,endDate:el('end-date').value,status:'proposed'};
}
function showAssessment(proposal) {
  const result = assessReservation(snapshot, proposal);
  const panel = el('assessment'); panel.className = `assessment ${result.ok ? 'good' : 'bad'}`;
  panel.replaceChildren(textNode('h3', result.ok ? '✓ This timeline holds together.' : '↯ The librarian found a paradox.'));
  if (result.ok) {
    panel.append(textNode('p','This request is eligible now. Approval checks the current timeline again.'));
    const add = textNode('button','Add proposal to the desk'); add.type='button';
    add.addEventListener('click', () => {
      // Proposals are intentionally nonblocking. Approval will recheck all current rules.
      const saved = {...proposal};
      snapshot = {...snapshot, reservations:[...snapshot.reservations, saved]};
      renderLedger();
      panel.replaceChildren(textNode('h3','Proposal added.'), textNode('p','Use Approve in the timeline below. It will be assessed again before becoming a blocking loan.'));
      el('ledger-feedback').textContent = `Proposal for ${findObject(proposal.objectId)?.name || 'object'} is waiting for approval.`;
    }, {once:true});
    panel.append(add);
  } else {
    const reasons = document.createElement('ul');
    result.reasons.forEach(reason => reasons.append(textNode('li',reason.message)));
    panel.append(reasons);
    const suggestions = suggestAlternatives(snapshot, proposal).slice(0,3);
    if (suggestions.length) {
      panel.append(textNode('p','Try a timeline that passes the same checks:'));
      suggestions.forEach(alt => {
        const button = textNode('button', alt.label || `${findObject(alt.objectId)?.name} · ${findEra(alt.eraId)?.name} · ${alt.startDate} → ${alt.endDate}`, 'alternative'); button.type='button';
        button.addEventListener('click', () => {
          el('object-select').value = alt.objectId; el('era-select').value = alt.eraId;
          resetDates(); el('start-date').value=alt.startDate; el('end-date').value=alt.endDate;
          currentProposal = {...proposal,...alt,id:`local-request-${++requestSequence}`,status:'proposed'};
          showAssessment(currentProposal);
        });
        panel.append(button);
      });
    }
  }
}
function renderLedger() {
  const ledger = el('ledger'); ledger.replaceChildren();
  snapshot.reservations.forEach(reservation => {
    const row = textNode('div','', 'ledger-row');
    const object = textNode('div',''); object.append(textNode('strong', findObject(reservation.objectId)?.name || 'Missing object'),textNode('small', reservation.borrower));
    const era = textNode('div',''); era.append(textNode('strong',findEra(reservation.eraId)?.name || 'Missing era'), textNode('small',`${reservation.startDate} → ${reservation.endDate}`));
    const status = textNode('div',''); status.append(textNode('span',reservation.status,`status ${reservation.status}`));
    const actions = textNode('div','', 'row-actions');
    if (reservation.status === 'proposed') {
      const approve = textNode('button','Approve'); approve.type='button'; approve.setAttribute('aria-label',`Approve ${findObject(reservation.objectId)?.name} for ${reservation.borrower}`);
      approve.addEventListener('click', () => {
        const result = approveReservation(snapshot,reservation.id);
        if (result.ok) { snapshot=result.snapshot; el('ledger-feedback').textContent='Approved after checking the current snapshot. This loan now blocks overlapping requests.'; renderLedger(); }
        else { el('ledger-feedback').textContent = `Approval refused: ${result.assessment.reasons.map(reason => reason.message).join(' ')}`; showAssessment(reservation); }
      });
      const reject = textNode('button','Reject'); reject.type='button'; reject.setAttribute('aria-label',`Reject ${findObject(reservation.objectId)?.name} for ${reservation.borrower}`);
      reject.addEventListener('click', () => { snapshot={...snapshot,reservations:snapshot.reservations.map(item => item.id===reservation.id?{...item,status:'rejected'}:item)}; el('ledger-feedback').textContent='Proposal rejected. Rejected loans do not block availability.';renderLedger(); });
      actions.append(approve,reject);
    } else actions.append(textNode('small',reservation.status==='approved'?'Blocks its borrowing window':'No active hold'));
    row.append(object,era,status,actions); ledger.append(row);
  });
  if (!snapshot.reservations.length) ledger.append(textNode('p','No loans in the timeline yet.','empty'));
}
el('reservation-form').addEventListener('submit',event => {event.preventDefault(); currentProposal=proposalFromForm();showAssessment(currentProposal);});
el('era-filter').addEventListener('change',renderCatalogue);
el('era-select').addEventListener('change',() => {resetDates();clearAssessment();});
['object-select','start-date','end-date','borrower-name'].forEach(id => el(id).addEventListener('change',clearAssessment));
el('reset-demo').addEventListener('click',() => {snapshot=clone(baseline);requestSequence=0;initialiseSelects();renderCatalogue();renderLedger();clearAssessment();el('ledger-feedback').textContent='Local changes cleared. The original catalogue and loans are restored.';});

initialiseSelects(); renderCatalogue(); renderLedger();
// A slow first read must not overwrite a user's rehearsal changes.
// All controls are locked until the initial catalogue has either loaded or failed.
const lockControls = locked => document.querySelectorAll('button,input,select').forEach(control => {control.disabled=locked;});
lockControls(true);
try {
  const loaded = await loadCatalogue(baseline);
  baseline = clone(loaded.snapshot); snapshot=clone(baseline);
  el('source-label').textContent=loaded.label;
  el('source-detail').textContent=loaded.detail;
  initialiseSelects();renderCatalogue();renderLedger();
} catch {
  el('source-label').textContent='Local fixture catalogue · Sanity connection unavailable';
  el('source-detail').textContent='No live content was loaded. Local rehearsal only.';
} finally {
  lockControls(false);
}
