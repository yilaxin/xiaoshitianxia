(function (root) {
  'use strict';
  const copy = value => structuredClone(value);
  const orderOf = state => ({ dishes: state.dishes.map(item => item.id), records: state.records.map(item => item.id), meals: state.meals.map(item => item.id) });
  function requireItem(items, id, kind) {
    const item = items.find(value => value.id === id);
    if (!item) throw new Error(kind + '已经不存在，请刷新后重试。');
    return item;
  }
  function removeDish(state, id) {
    const dish = requireItem(state.dishes, id, '这道菜');
    const records = state.records.filter(record => record.dishId === id);
    const next = copy(state);
    next.dishes = next.dishes.filter(item => item.id !== id);
    next.records = next.records.filter(record => record.dishId !== id);
    return { state: next, undo: copy({ dishes: [dish], records, meals: [], relatedDishes: [], order: orderOf(state) }) };
  }
  function removeMeal(state, id) {
    const meal = requireItem(state.meals, id, '这顿饭');
    const records = state.records.filter(record => record.mealId === id);
    const next = copy(state);
    next.meals = next.meals.filter(item => item.id !== id);
    next.records = next.records.filter(record => record.mealId !== id);
    return { state: next, undo: copy({ dishes: [], records, meals: [meal], relatedDishes: state.dishes.filter(dish => records.some(record => record.dishId === dish.id)), order: orderOf(state) }) };
  }
  function removeRecord(state, id) {
    const record = requireItem(state.records, id, '这次品尝记录');
    const next = copy(state);
    next.records = next.records.filter(item => item.id !== id);
    return { state: next, undo: copy({ dishes: [], records: [record], meals: [], relatedDishes: state.dishes.filter(dish => dish.id === record.dishId), order: orderOf(state) }) };
  }
  function restoreRemoved(state, undo) {
    const next = copy(state);
    for (const dish of [...undo.dishes, ...undo.relatedDishes]) {
      if (!next.dishes.some(item => item.id === dish.id)) {
        const restored = copy(dish);
        if (restored.category && !next.categories.includes(restored.category)) restored.category = '';
        next.dishes.push(restored);
      }
    }
    for (const meal of undo.meals) if (!next.meals.some(item => item.id === meal.id)) next.meals.push(copy(meal));
    for (const record of undo.records) {
      if (next.records.some(item => item.id === record.id)) continue;
      const restored = copy(record);
      if (restored.mealId && !next.meals.some(meal => meal.id === restored.mealId)) restored.mealId = null;
      next.records.push(restored);
    }
    for (const key of ['dishes', 'records', 'meals']) {
      const positions = new Map((undo.order?.[key] || []).map((id, index) => [id, index]));
      next[key].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
    }
    return next;
  }
  const api = { removeDish, removeMeal, removeRecord, restoreRemoved };
  root.FoodDataActions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
