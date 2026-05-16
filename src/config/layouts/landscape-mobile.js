export default {
  controlBar: {
    contentHeight: { pixels: 44, percent: 0.08 },
    spacingPercent: { items: 0.01, rows: 0.2 },
    paddingPercent: { top: 0.01, bottom: 0.01 },
    insetPercent: { horizontal: 0.01 },
    header: {
      items: ['winText', 'betText', 'balanceText'],
      fontSize: 17,
      verticalOffset: 0.015,
      lines: 2
    },
    layoutGroups: [
      ['soundButton', 'infoButton', 'speedButton'],
      ['playButton', 'autoButton']
    ]
  },
  cardContainer: { areaPercent: 0.98, offsetYPercent: 0 },
  messageText: {
    heightPercent: 0.17,
    percentY: -0.025,
    centerInLeftBand: true,
    insetPercent: { horizontal: 0.06 },
    stroke: { lineWidth: 4 }
  },
  instructionsText: {
    fontSize: 20,
    useRightBandWhenAvailable: true
  }
};
