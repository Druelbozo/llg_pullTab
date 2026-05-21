export default {
  controlBar: {
    contentHeight: { pixels: null, percent: 0.075 },
    spacingPercent: { items: 0.01, rows: 0.2 },
    paddingPercent: { top: 0.01, bottom: 0.01 },
    insetPercent: { horizontal: 0.31 },
    header: {
      items: ['winText', 'balanceText'],
      fontSize: 21,
      verticalOffset: 0.004,
      lines: 1
    },
    layoutGroups: [
      ['soundButton', 'infoButton', 'speedButton'],
      ['autoButton', 'playButton']
    ]
  },
  cardContainer: { areaPercent: 0.65, offsetYPercent: 0 },
  messageText: { heightPercent: 0.092, percentY: -0.075 },
  win: { heightPercent: 0.6 },
  lose: { heightPercent: 0.6 }
};
