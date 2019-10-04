# -*- coding: utf-8 -*-


from django.contrib.gis.geos import Point
from django.db import models, migrations

def get_sample_destinations():
    return [
        {
            'name': 'Fairmount Waterworks Interpretive Center',
            'website_url': 'http://fairmountwaterworks.com/index.php',
            'description': '<p>The mission of the Fairmount Water Works (FWW)  is to foster stewardship of our shared water resources by encouraging informed decisions about the use of land and water. We educate citizens about Philadelphia’s urban watershed – its past, present and future – and collaborate with partners to instill an appreciation for the connections between daily life and the natural environment.</p>',
            'address': '640 Water Works Drive',
            'zip': '19130',
            'point': Point(-75.183494, 39.965811),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Independence Seaport Museum',
            'website_url': 'http://www.phillyseaport.org',
            'description': '<p>Explore Philadelphia\'s only maritime museum! See nautical art, interactive exhibits, the Workshop on the Water, and our two historic ships - the cruiser Olympia, the oldest steel warship still afloat in the world and the WWII-era submarine Becuna - all included in Museum admission.</p>',
            'address': '211 South Christopher Columbus Boulevard',
            'zip': '19106',
            'point': Point(-75.140455, 39.945904),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Bartram\'s Garden',
            'website_url': 'http://www.bartramsgarden.org',
            'description': '<p>John Bartram, America’s first botanist, was endlessly curious about the natural world.  He wanted to learn everything about the world around him. He truly believed that all living things were beautiful in their own right.  His explorations of wild American landscapes were deeply influential to Europeans who were hungry for any and all information about the New World.</p>',
            'address': '5400 Lindbergh Blvd',
            'zip': '19143',
            'point': Point(-75.212414, 39.932859),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Schuylkill Environmental Education Center',
            'website_url': 'http://www.schuylkillcenter.org',
            'description': '<p>The Schuylkill Center inspires meaningful connections between people and nature. We use our forests and fields as a living laboratory to foster appreciation, deepen understanding, and encourage stewardship of the environment.</p>',
            'address': '8480 Hagys Mill Rd',
            'zip': '19128',
            'point': Point(-75.244640, 40.060265),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'John Heinz National Wildlife Refuge',
            'website_url': 'http://www.fws.gov/refuge/john_heinz/',
            'description': '<p>John Heinz National Wildlife Refuge at Tinicum is America\'s First Urban Refuge and was established in 1972 for the purpose of preserving, restoring, and developing the natural area known as Tinicum Marsh, to promote environmental education, and to afford visitors an opportunity to study wildlife in its natural habitat.</p>',
            'address': '8601 Lindbergh Blvd',
            'zip': '19153',
            'point': Point(-75.268882, 39.878307),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'NJ Academy of Aquatic Sciences',
            'website_url': 'http://www.njaquarium.org',
            'description': '<p>The mission of the Center for Aquatic Sciences at Adventure Aquarium is Education and Youth Development through promoting the understanding, appreciation, and protection of aquatic life and habitats. The nonprofit Center for Aquatic Sciences at Adventure Aquarium (CAS) is a leader in conservation-oriented research, environmental education, and community service both locally and globally.</p>',
            'address': '1 Riverside Dr',
            'city': 'Camden',
            'state': 'NJ',
            'zip': '08103',
            'point': Point(-75.130645, 39.944052),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Schuylkill River Greenway Association',
            'website_url': 'http://www.schuylkillriver.org',
            'description': '<p>With the 128-mile Schuylkill River as its spine, our Schuylkill River National and State Heritage Area is alive with a remarkable diversity of historic, recreational and cultural attractions. Visitors can shadow the birth of our nation from the fabled landmarks of Philadelphia to the huts and hollows of Valley Forge. Upstream you\'ll find a wealth of historic places, quaint river towns, parks and access to the river and trails.</p>',
            'address': '140 College Dr',
            'city': 'Pottstown',
            'state': 'PA',
            'zip': '19464',
            'point': Point(-75.653681, 40.243561),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Palmyra Cove Nature Park',
            'website_url': 'http://www.palmyracove.org',
            'description': '<p>Palmyra Cove Nature Park (PCNP) is a 250 acre urban oasis along a highly developed area on the Delaware River. Habitats included in PCNP are wetlands, woodlands, meadows, wild creek and river shoreline, and freshwater Tidal Cove. By protecting this habitat, PCNP preserves the ecological richness of the local environment.</p>',
            'address': '1335 NJ-73',
            'city': 'Palmyra',
            'state': 'NJ',
            'zip': '08065',
            'point': Point(-75.041969, 40.004362),
            'image': None,
            'wide_image': None,
            'published': True
        },
        {
            'name': 'Tulpehaking Nature Center at Abbott Marshland',
            'website_url': 'http://www.marsh-friends.org',
            'description': '<p>An oasis of natural beauty, the Abbott Marshlands are a unique urban natural area rich with natural and historical significance. They include the northernmost tidal freshwater wetland on the Delaware River and provide diverse habitats for many species of birds, plants, mammals, amphibians and reptiles, including a number that are threatened or endangered. The Marshlands encompass tidal and non-tidal marshes, forested swamps, and upland forests. Ponds, creeks, the Delaware and Raritan Canal, and the Delaware River are all part of this diverse landscape.</p>',
            'address': '157 Westcott Avenue',
            'city': 'Trenton',
            'state': 'NJ',
            'zip': '08610',
            'point': Point(-74.725370, 40.191104),
            'image': None,
            'wide_image': None,
            'published': True
        },
    ]

def add_sample_destinations(apps, schema_editor):
    Destination = apps.get_model('destinations', 'Destination')
    for destination in get_sample_destinations():
        sample_dests = Destination.objects.filter(name=destination['name'])
        if len(sample_dests) == 0:
            sample_dest = Destination(**destination)
            sample_dest.save()


def delete_sample_destinations(apps, schema_editor):
    Destination = apps.get_model('destinations', 'Destination')
    for destination in get_sample_destinations():
        try:
            sample_dests = Destination.objects.filter(name=destination['name'])
            sample_dests.delete()
        except Destination.DoesNotExist:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('destinations', '0011_auto_20150316_1056'),
    ]

    operations = [
        migrations.RunPython(add_sample_destinations, delete_sample_destinations),
    ]
