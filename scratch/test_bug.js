import fs from 'fs';
import { solveRailbound } from './railbound-logic.js';

const puzzle = {
  "width": 7,
  "height": 7,
  "fixed": {
    "2,0": "-",
    "3,0": "-",
    "4,0": "-",
    "5,0": "-",
    "6,0": "-",
    "2,1": "-",
    "1,4": "-",
    "2,4": "-",
    "3,4": "-",
    "3,6": "-"
  },
  "blanks": [
    [0,0], [1,0], [0,1], [1,1], [3,1], [4,1], [5,1], [6,1],
    [1,2], [2,2], [3,2], [4,2], [5,2], [6,2],
    [4,4], [5,4],
    [0,5], [1,5], [2,5], [3,5], [4,5], [5,5], [6,5],
    [0,6], [1,6], [2,6], [4,6], [5,6], [6,6]
  ],
  "cars": [
    {"name": "1", "x": 2, "y": 0, "entry": "E"},
    {"name": "2", "x": 6, "y": 0, "entry": "E"}
  ],
  "goal": [6,4],
  "goal_entry": "W",
  "order": ["1", "2"],
  "max_steps": 50,
  "tunnels": [
    {
      "color": "#e74c3c",
      "cells": [
        {"x": 0, "y": 2, "facing": "E"},
        {"x": 0, "y": 4, "facing": "E"}
      ]
    }
  ],
  "triggers": [
    {"x": 2, "y": 1, "color": "#e8584a"},
    {"x": 3, "y": 6, "color": "#e8584a"}
  ],
  "barriers": [
    {"x": 3, "y": 0, "color": "#e8584a", "initialState": "open"},
    {"x": 5, "y": 0, "color": "#e8584a", "initialState": "closed"},
    {"x": 1, "y": 4, "color": "#e8584a", "initialState": "closed"},
    {"x": 3, "y": 4, "color": "#e8584a", "initialState": "open"}
  ]
};

const result = solveRailbound(puzzle, { maxTracks: 20 });
console.log(result);
