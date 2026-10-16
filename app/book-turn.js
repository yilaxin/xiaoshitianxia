(function () {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coverFlip = flipBook;
  const baseRender = render;
  let activeTurn = null;
  const duration = 860;

  function finishTurn(turn, complete, redraw = true) {
    if (activeTurn !== turn) return;
    activeTurn = null;
    turn.animations.forEach(animation => animation.cancel());
    turn.book.replaceChildren(...turn.originalPages);
    turn.book.classList.remove('has-turning-paper');
    turn.stage.setAttribute('aria-busy', 'false');
    turn.controls.forEach(([control, disabled]) => { control.disabled = disabled; });
    bookBusy = false;
    if (complete) {
      state.bookIndex = turn.targetIndex;
      if (!save()) state.bookIndex = turn.fromIndex;
    }
    if (redraw && view === 'book') render();
  }

  function animated(turn, element, keyframes, id) {
    const animation = element.animate(keyframes, {
      duration, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both'
    });
    animation.id = id;
    turn.animations.push(animation);
    return animation;
  }

  function pageFace(page, side) {
    const face = document.createElement('div');
    face.className = `paper-face paper-${side}`;
    face.append(page.cloneNode(true));
    const light = document.createElement('div');
    light.className = 'paper-light';
    face.append(light);
    return face;
  }

  flipBook = async function (delta) {
    if (bookCover) { coverFlip(delta); return; }
    if (bookBusy) return;
    const direction = Math.sign(delta);
    const list = bookDishes();
    const fromIndex = state.bookIndex || 0;
    const targetIndex = fromIndex + direction;
    if (!direction || targetIndex < 0 || targetIndex >= list.length) return;
    const book = document.getElementById('bookSpread');
    if (!book) return;
    if (reducedMotion.matches || getComputedStyle(book).gridTemplateColumns.split(' ').length < 2) {
      state.bookIndex = targetIndex;
      if (!save()) state.bookIndex = fromIndex;
      render();
      return;
    }

    // Build the next spread offscreen without committing a page change yet.
    const template = document.createElement('template');
    try {
      state.bookIndex = targetIndex;
      template.innerHTML = renderBook();
    } finally { state.bookIndex = fromIndex; }
    const nextBook = template.content.querySelector('#bookSpread');
    const stage = book.closest('.book-stage');
    const controls = [...document.querySelectorAll('.book-nav button,.book-toolbar button,.book-toolbar select')]
      .map(control => [control, control.disabled]);
    const turn = { book, stage, controls, fromIndex, targetIndex, originalPages: [...book.childNodes], animations: [] };
    activeTurn = turn;
    bookBusy = true;
    controls.forEach(([control]) => { control.disabled = true; });
    stage.setAttribute('aria-busy', 'true');
    try {
      // Avoid a blank reverse face when turning to a photo not decoded yet.
      await Promise.all([...nextBook.querySelectorAll('img')].map(photo => photo.decode().catch(() => {})));
      if (activeTurn !== turn) return;
      const forward = direction > 0;
      const oldLeft = book.querySelector('.book-left');
      const oldRight = book.querySelector('.book-right');
      const newLeft = nextBook.querySelector('.book-left');
      const newRight = nextBook.querySelector('.book-right');
      const movingFront = forward ? oldRight : oldLeft;
      const movingBack = forward ? newLeft : newRight;
      const frontScroll = movingFront.scrollTop;
      const backScroll = movingBack.scrollTop;
      // The next page is already underneath the sheet being lifted.
      if (forward) oldRight.replaceWith(newRight.cloneNode(true));
      else oldLeft.replaceWith(newLeft.cloneNode(true));

      const space = document.createElement('div');
      space.className = `paper-turn-space ${forward ? 'turn-forward' : 'turn-backward'}`;
      space.setAttribute('aria-hidden', 'true');
      space.inert = true;
      const sheet = document.createElement('div');
      sheet.className = 'paper-leaf';
      const frontFace = pageFace(movingFront, 'front');
      const backFace = pageFace(movingBack, 'back');
      sheet.append(frontFace, backFace);
      const edge = document.createElement('div');
      edge.className = 'paper-edge';
      sheet.append(edge);
      const cast = document.createElement('div');
      cast.className = 'paper-cast-shadow';
      const landing = document.createElement('div');
      landing.className = 'paper-landing-shadow';
      const gutter = document.createElement('div');
      gutter.className = 'paper-gutter-shadow';
      space.append(cast, landing, sheet, gutter);
      book.append(space);
      book.classList.add('has-turning-paper');
      // cloneNode does not preserve the scroll position of a long text page.
      frontFace.firstElementChild.scrollTop = frontScroll;
      backFace.firstElementChild.scrollTop = backScroll;

      const sign = forward ? -1 : 1;
      const rotation = animated(turn, sheet, [
        { transform: 'translateZ(0px) rotateY(0deg) rotateZ(0deg)', offset: 0 },
        { transform: `translateZ(8px) rotateY(${sign * 32}deg) rotateZ(${sign * .35}deg)`, offset: .22 },
        { transform: `translateZ(22px) rotateY(${sign * 90}deg) rotateZ(${sign * .5}deg)`, offset: .5 },
        { transform: `translateZ(10px) rotateY(${sign * 152}deg) rotateZ(${sign * .2}deg)`, offset: .78 },
        { transform: `translateZ(0px) rotateY(${sign * 180}deg) rotateZ(0deg)`, offset: 1 }
      ], 'xstx-paper-rotation');
      animated(turn, sheet.querySelector('.paper-front .paper-light'), [
        { opacity: 0 }, { opacity: .2, offset: .25 }, { opacity: .54, offset: .5 }, { opacity: .54 }
      ], 'xstx-paper-front-light');
      animated(turn, sheet.querySelector('.paper-back .paper-light'), [
        { opacity: .48 }, { opacity: .48, offset: .5 }, { opacity: .15, offset: .8 }, { opacity: 0 }
      ], 'xstx-paper-back-light');
      animated(turn, cast, [
        { opacity: 0, transform: 'scaleX(.05)' },
        { opacity: .27, transform: 'scaleX(.55)', offset: .25 },
        { opacity: .2, transform: 'scaleX(.94)', offset: .5 },
        { opacity: .12, transform: 'scaleX(.35)', offset: .8 },
        { opacity: 0, transform: 'scaleX(.02)' }
      ], 'xstx-paper-cast-shadow');
      animated(turn, gutter, [
        { opacity: .08 }, { opacity: .48, offset: .5 }, { opacity: .08 }
      ], 'xstx-paper-gutter-shadow');
      animated(turn, landing, [
        { opacity: 0 }, { opacity: 0, offset: .38 },
        { opacity: .22, offset: .68 }, { opacity: .08, offset: .88 }, { opacity: 0 }
      ], 'xstx-paper-landing-shadow');
      await rotation.finished;
      finishTurn(turn, true);
    } catch {
      // Cancellation, navigation, or a compositor failure restores an unlocked spread.
      finishTurn(turn, false);
    }
  };

  render = function () {
    if (activeTurn) finishTurn(activeTurn, false, false);
    baseRender();
  };
  window.addEventListener('resize', () => { if (activeTurn) finishTurn(activeTurn, true); });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && activeTurn) finishTurn(activeTurn, true);
  });
})();
