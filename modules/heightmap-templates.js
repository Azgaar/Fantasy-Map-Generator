"use strict";

window.HeightmapTemplates = (function () {
  const volcano = `Hill 1 90-100 44-56 40-60
    Multiply 0.8 50-100 0 0
    Range 1.5 30-55 45-55 40-60
    Smooth 2 0 0 0
    Hill 1.5 25-35 25-30 20-75
    Hill 1 25-35 75-80 25-75
    Hill 0.5 20-25 10-15 20-25`;

  const highIsland = `Hill 1 90-100 65-75 47-53
    Add 5 all 0 0
    Hill 6 20-23 25-55 45-55
    Range 1 40-50 45-55 45-55
    Smooth 2 0 0 0
    Trough 2-3 20-30 20-30 20-30
    Trough 2-3 20-30 60-80 70-80
    Hill 1 10-15 60-60 50-50
    Hill 1.5 13-16 15-20 20-75
    Multiply 0.8 20-100 0 0
    Range 1.5 30-40 15-85 30-40
    Range 1.5 30-40 15-85 60-70
    Pit 2-3 10-15 15-85 20-80`;

  const lowIsland = `Hill 1 90-99 60-80 45-55
    Hill 4-5 25-35 20-65 40-60
    Range 1 40-50 45-55 45-55
    Smooth 3 0 0 0
    Trough 1.5 20-30 15-85 20-30
    Trough 1.5 20-30 15-85 70-80
    Hill 1.5 10-15 5-15 20-80
    Hill 1 10-15 85-95 70-80
    Pit 3-5 10-15 15-85 20-80
    Multiply 0.4 20-100 0 0`;

  const continents = `Hill 1 80-85 75-80 40-60
    Hill 1 80-85 20-25 40-60
    Multiply 0.22 20-100 0 0
    Hill 5-6 15-20 25-75 20-82
    Range .8 30-60 5-15 20-45
    Range .8 30-60 5-15 55-80
    Range 0-3 30-60 80-90 20-80
    Trough 3-4 15-20 15-85 20-80
    Strait 2 vertical 0 0
    Smooth 2 0 0 0
    Trough 1-2 5-10 45-55 45-55
    Pit 3-4 10-15 15-85 20-80
    Hill 1 5-10 40-60 40-60`;

  const archipelago = `Add 11 all 0 0
    Range 2-3 40-60 20-80 20-80
    Hill 5 15-20 10-90 30-70
    Hill 2 10-15 10-30 20-80
    Hill 2 10-15 60-90 20-80
    Smooth 3 0 0 0
    Trough 10 20-30 5-95 5-95
    Strait 2 vertical 0 0
    Strait 2 horizontal 0 0`;

  const atoll = `Hill 1 75-80 50-60 45-55
    Hill 1.5 30-50 25-75 30-70
    Hill .5 30-50 25-35 30-70
    Smooth 1 0 0 0
    Multiply 0.2 25-100 0 0
    Hill .5 10-20 50-55 48-52`;

  const mediterranean = `Range 3-4 30-50 0-100 0-10
    Range 3-4 30-50 0-100 90-100
    Hill 5-6 30-70 0-100 0-5
    Hill 5-6 30-70 0-100 95-100
    Smooth 1 0 0 0
    Hill 2-3 30-70 0-5 20-80
    Hill 2-3 30-70 95-100 20-80
    Multiply 0.8 land 0 0
    Trough 3-5 40-50 0-100 0-10
    Trough 3-5 40-50 0-100 90-100`;

  const peninsula = `Range 2-3 20-35 40-50 0-15
    Add 5 all 0 0
    Hill 1 90-100 10-90 0-5
    Add 13 all 0 0
    Hill 3-4 3-5 5-95 80-100
    Hill 1-2 3-5 5-95 40-60
    Trough 5-6 10-25 5-95 5-95
    Smooth 3 0 0 0`;

  const pangea = `Hill 1-2 25-40 15-50 0-10
    Hill 1-2 5-40 50-85 0-10
    Hill 1-2 25-40 50-85 90-100
    Hill 1-2 5-40 15-50 90-100
    Hill 8-12 20-40 20-80 48-52
    Smooth 2 0 0 0
    Multiply 0.7 land 0 0
    Trough 3-4 25-35 5-95 10-20
    Trough 3-4 25-35 5-95 80-90
    Range 5-6 30-40 10-90 35-65`;

  const isthmus = `Hill 5-10 15-30 0-30 0-20
    Hill 5-10 15-30 10-50 20-40
    Hill 5-10 15-30 30-70 40-60
    Hill 5-10 15-30 50-90 60-80
    Hill 5-10 15-30 70-100 80-100
    Smooth 2 0 0 0
    Trough 4-8 15-30 0-30 0-20
    Trough 4-8 15-30 10-50 20-40
    Trough 4-8 15-30 30-70 40-60
    Trough 4-8 15-30 50-90 60-80
    Trough 4-8 15-30 70-100 80-100`;

  const shattered = `Hill 8 35-40 15-85 30-70
    Trough 10-20 40-50 5-95 5-95
    Range 5-7 30-40 10-90 20-80
    Pit 12-20 30-40 15-85 20-80`;

  const taklamakan = `Hill 1-3 20-30 30-70 30-70
    Hill 2-4 60-85 0-5 0-100
    Hill 2-4 60-85 95-100 0-100
    Hill 3-4 60-85 20-80 0-5
    Hill 3-4 60-85 20-80 95-100`;

  return {volcano, highIsland, lowIsland, continents, archipelago, atoll, mediterranean, peninsula, peninsula, pangea, isthmus, shattered, taklamakan};
})();
