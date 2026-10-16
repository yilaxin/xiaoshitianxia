const assert = require('node:assert/strict');
const { removeDish, removeMeal, removeRecord, restoreRemoved } = require('../app/data-actions.js');
const { validate } = require('../app/desktop/storage.cjs');

const state = {
  version: 1, categories: ['主食', '素菜'], bookIndex: 0, lastBackup: null,
  dishes: [
    { id: 'd1', name: '炒饭', category: '主食', tags: ['家常'], favorite: true, description: '熟悉的味道', cover: 'rice', created: '2026-10-15' },
    { id: 'd2', name: '沙拉', category: '素菜', tags: [], favorite: false, description: '', cover: 'salad', created: '2026-10-15' }
  ],
  meals: [
    { id: 'm1', date: '2026-10-15', title: '周末午饭', type: '午餐', place: '家里', maker: '自己', note: '要保留的餐桌回忆' },
    { id: 'm2', date: '2026-10-16', title: '又吃炒饭', type: '午餐', place: '家里', maker: '自己', note: '' }
  ],
  records: [
    { id: 'r1', dishId: 'd1', mealId: 'm1', date: '2026-10-15', photos: ['rice'], note: '第一次' },
    { id: 'r2', dishId: 'd2', mealId: 'm1', date: '2026-10-15', photos: ['salad'], note: '清爽' },
    { id: 'r3', dishId: 'd1', mealId: 'm2', date: '2026-10-16', photos: ['rice'], note: '第二次' },
    { id: 'r4', dishId: 'd1', mealId: null, date: '2026-10-14', photos: ['rice'], note: '单独记录' }
  ]
};
const original = structuredClone(state);
const dish = removeDish(state, 'd1');
assert.deepEqual(dish.state.dishes.map(item => item.id), ['d2']);
assert.deepEqual(dish.state.records.map(item => item.id), ['r2']);
assert.deepEqual(dish.state.meals, state.meals, 'Deleting a dish must retain meal titles and notes, including an empty meal');
validate(dish.state);
assert.deepEqual(restoreRemoved(dish.state, dish.undo), state, 'Undo restores contents and their original order');

const meal = removeMeal(state, 'm1');
assert.deepEqual(meal.state.dishes, state.dishes, 'Deleting a meal must preserve menu collections');
assert.deepEqual(meal.state.records.map(item => item.id), ['r3', 'r4'], 'Other dates and standalone tastings must remain');
assert.deepEqual(meal.state.meals.map(item => item.id), ['m2']);
validate(meal.state);
assert.deepEqual(restoreRemoved(meal.state, meal.undo), state);

const record = removeRecord(state, 'r1');
assert.deepEqual(record.state.records.map(item => item.id), ['r2', 'r3', 'r4']);
assert.deepEqual(record.state.meals, state.meals);
assert.deepEqual(record.state.dishes, state.dishes);
assert.deepEqual(restoreRemoved(record.state, record.undo), state);

const changed = structuredClone(meal.state);
changed.dishes[0].description = '删除之后补充的新备注';
changed.dishes.push({ ...state.dishes[0], id: 'd3', name: '新收藏' });
const merged = restoreRemoved(changed, meal.undo);
assert.equal(merged.dishes[0].description, '删除之后补充的新备注', 'Undo must retain subsequent edits');
assert.ok(merged.dishes.some(item => item.id === 'd3'), 'Undo must retain newly created dishes');
assert.equal(merged.records.length, state.records.length);
assert.deepEqual(restoreRemoved(merged, meal.undo), merged, 'Repeated undo must not duplicate records');
validate(merged);

assert.throws(() => removeDish(state, 'missing'));
assert.throws(() => removeMeal(state, 'missing'));
assert.throws(() => removeRecord(state, 'missing'));
assert.deepEqual(state, original, 'All operations must leave the input immutable');
console.log('PASS: dish/meal/tasting deletion boundaries, empty-meal preservation, reversible ordering, undo after edits, missing IDs, immutable input');
