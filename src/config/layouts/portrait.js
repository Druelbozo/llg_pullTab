export default {
  controlBar: {
    contentHeight: { pixels: null, percent: 0.08 },
    spacingPercent: { items: 0.1, rows: 0.2 },
    paddingPercent: { top: 0, bottom: 0 },
    insetPercent: { horizontal: 0 },
    header: {
      items: ['winText', 'betText', 'balanceText'],
      fontSize: 21,
      verticalOffset: 0.003
    },
    layoutGroups: [
      ['soundButton', 'infoButton', 'speedButton'],
      ['playButton', 'autoButton']
    ]
  },
  cardContainer: { areaPercent: 0.65, offsetYPercent: 0 },
  messageText: { heightPercent: 0.1, percentY: 0 }
};
