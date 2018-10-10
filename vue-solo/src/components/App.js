import UserList from './UserList.js';
import FantasyMapGenerator from './FantasyMapGenerator.js';

export default {
  name: `App`,
  components: {
    FantasyMapGenerator,
    UserList,
  },
  template: `
    <div class="container mx-auto p-4">
      <div style="display: block; position: absolute; z-index: 2; left: 25px; top: 280px">
        <user-list></user-list>
      </div>
      <div style="display: block; position: absolute; z-index: 1">
        <fantasy-map-generator></fantasy-map-generator>
      </div>
    </div>
  `,
};
