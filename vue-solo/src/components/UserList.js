const UserInfo = () => import('./UserInfo.js');

export default {
  name: `UserList`,
  components: {
    UserInfo,
  },
  data() {
    return {
      users: [
        {
          img: `https://www.ffcompendium.com/jobimages/3-dragooningus-a.jpg`,
          name: `Knight Kentigern`,
          department: `JS Dragoons`,

          info: `You, fair knight, have been selected to pursue
          the dragon harassing the good people of the Silver Lake district. Along with that mess,
          you can also aid in the effors to modernize this library and slay the 10K+ line code base.`,
          showInfo: false,
        },
      ],
      quest: {
        description: `Join our Epic Port to Vue JS!`,
      },
      showPeople: true,
    };
  },
  template: `
    <div v-if="showPeople" style="background: white; padding: 0px; margin: 0px; border-radius: 0px; opacity: 1; border: 1px solid black">
    <div style="display: flex; flex-direction: row; justify-content: space-between; width: 300px; height: 38px; background: black; border-bottom: 1px solid black">
      <div style="width: 250px; padding-left: 10px"><p style="color:white; font-size: 12px; font-size: bold; margin-top: 10px">Heroes Wanted!</p></div>
      <div>
        <button
          style="border: 1px solid #eee; color: white; background: black; padding: 5px; font-size: 12px; margin: 5px; font-weight: bold"
          @click="showPeople = !showPeople"
        >
          X
        </button>
      </div>
    </div>
    <ul style="list-style-type: none">
      <li v-for="user in users" :key="user.name">
        <img :src="user.img" :alt="user.name" width="100px">
        <div>
          <h3 style="color: #666; margin: 0px; padding: 0px">{{ user.name }}</h3>
          <p style="color: #999; margin: 0px; margin-bottom: 20px; padding: 0px">{{ user.department }}</p>
          <p style="color: #999; margin: 0px; margin-bottom: 20px; padding: 0px">{{ quest.description }}</p>
          <button
            style="border: 1px solid #666; padding: 10px; font-size: 12px"
            @click="user.showInfo = !user.showInfo"
          >
            {{ !user.showInfo ? 'Learn more' : 'Less' }}
          </button>
          <user-info v-if="user.showInfo" style="max-width: 239px;">
            {{ user.info }}
            <p>
            <a href="https://github.com/Azgaar/Fantasy-Map-Generator" target="_blank">github guild</a>
            </p>
          </user-info>
        </div>
      </li>
    </ul>
    </div>
  `,
};
