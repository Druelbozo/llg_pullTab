export default {
  controlBar: {
    contentHeight: { pixels: 44, percent: 0 },
    spacingPercent: { items: 0.01, rows: 0.15 },
    paddingPercent: { top: 0.01, bottom: 0.01 },
    insetPercent: { horizontal: 0.01 },
    header: {
      items: ['winText', 'balanceText'],
      fontSize: 17,
      verticalOffset: 0.001,
      lines: 2
    },
    layoutGroups: [
      ['soundButton', 'infoButton', 'speedButton'],
      ['autoButton', 'playButton']
    ]
  },
  cardContainer: { areaPercent: 0.95, offsetYPercent: 0 },
  messageText: {
    heightPercent: 0.15,
    percentY: 0,
    centerVertically: true,
    stroke: { lineWidth: 4 }
  },
  instructionsText: {
    fontSize: 20
  }
};
