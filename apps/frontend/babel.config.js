module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    'nativewind/babel',
    [
      '@babel/plugin-proposal-private-property-in-object',
      {
        "loose": true
      }
    ],
    'react-native-reanimated/plugin',
  ],
};
